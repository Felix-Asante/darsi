import type { INestApplication } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { addDays, todayIn } from '../src/common/dates/calendar-date.js';
import { FilesService } from '../src/modules/files/files.service.js';
import { ObjectStorage } from '../src/modules/files/object-storage.service.js';
import { ReportsService } from '../src/modules/reports/reports.service.js';
import { createTestApp } from './support/create-test-app.js';
import {
  addMember,
  createSchool,
  deliverMail,
  mailbox,
  uniqueEmail,
} from './support/identity.js';

const text = (value: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }],
});

describe('Portfolio and progress reports (e2e)', () => {
  let app: INestApplication;
  const today = todayIn('Europe/Paris');

  beforeAll(async () => {
    app = await createTestApp();
    await app.get(ObjectStorage).ensureBucket();
  });

  afterAll(async () => {
    await app.close();
  });

  async function setUp() {
    const school = await createSchool(app);
    const post = async (path: string, body: object) =>
      (await school.admin.post(`/api/v1${path}`).send(body).expect(201)).body;
    const year = await post('/academics/years', {
      name: 'Year',
      startsOn: addDays(today, -60),
      endsOn: addDays(today, 200),
    });
    const term = await post(`/academics/years/${year.id}/terms`, {
      name: 'Term 1',
      startsOn: addDays(today, -60),
      endsOn: addDays(today, 30),
    });
    const subject = await post('/academics/subjects', {
      code: 'MATH',
      name: 'Mathematics',
    });
    const scale = await post('/grading/scales', {
      name: 'Marks',
      preset: 'french_20',
    });
    await school.admin
      .put('/api/v1/grading/policies')
      .send({
        subjectId: null,
        reportingScaleId: scale.id,
        method: 'weighted_average',
        categories: [],
      })
      .expect(200);
    const schoolClass = await post('/academics/classes', {
      academicYearId: year.id,
      code: 'M7A',
      name: 'Maths 7A',
      subjectId: subject.id,
    });
    const teacher = await addMember(app, school, ['teacher']);
    const assistant = await addMember(app, school, ['teaching_assistant']);
    const coordinator = await addMember(app, school, ['coordinator']);
    await school.admin
      .put(`/api/v1/academics/classes/${schoolClass.id}/staff`)
      .send({
        staff: [
          { userId: teacher.userId, role: 'teacher' },
          { userId: assistant.userId, role: 'teaching_assistant' },
        ],
      })
      .expect(200);

    const studentEmail = uniqueEmail('student');
    const parentEmail = uniqueEmail('parent');
    const student = await post('/students', {
      studentNumber: `S-${uuidv7().slice(-6)}`,
      firstName: 'Amira',
      lastName: 'Haddad',
      email: studentEmail,
    });
    await post(`/academics/classes/${schoolClass.id}/students`, {
      studentIds: [student.id],
    });
    const guardian = await post('/guardians', {
      firstName: 'Leila',
      lastName: 'Haddad',
      email: parentEmail,
      preferredLocale: 'fr',
    });
    await post(`/students/${student.id}/guardians`, {
      guardianId: guardian.id,
      relationship: 'mother',
    });
    const studentMember = await addMember(
      app,
      school,
      ['student'],
      studentEmail,
    );
    const parent = await addMember(app, school, ['guardian'], parentEmail);
    await deliverMail(app);
    return {
      school,
      term,
      scale,
      schoolClass,
      teacher,
      assistant,
      coordinator,
      student,
      studentMember,
      parent,
      parentEmail,
    };
  }

  it('runs a term to a published PDF report the family is told about (Release 2 exit criterion)', async () => {
    const {
      school,
      term,
      scale,
      schoolClass,
      teacher,
      assistant,
      coordinator,
      student,
      parent,
      parentEmail,
    } = await setUp();
    const { body: test } = await teacher.session
      .post(`/api/v1/assessment/classes/${schoolClass.id}/assessments`)
      .send({
        title: 'Fractions',
        kind: 'summative',
        dueOn: addDays(today, -10),
        scaleId: scale.id,
      })
      .expect(201);
    await teacher.session
      .put(`/api/v1/assessment/assessments/${test.id}/grades`)
      .send({ grades: [{ studentId: student.id, value: '15' }], publish: true })
      .expect(200);
    await teacher.session
      .put(`/api/v1/attendance/classes/${schoolClass.id}`)
      .send({
        date: today,
        records: [{ studentId: student.id, status: 'late' }],
      })
      .expect(200);

    await school.admin
      .put('/api/v1/reports/templates')
      .send({
        name: 'Middle school report',
        subjectIds: [],
        includeAttendance: true,
        includeGeneralComment: true,
      })
      .expect(200);
    const { body: opened } = await school.admin
      .post(`/api/v1/reports/terms/${term.id}/open`)
      .send({ locale: 'fr' })
      .expect(200);
    expect(opened).toEqual({ students: 1, entriesAdded: 1 });

    const sheetUrl = `/api/v1/reports/terms/${term.id}/classes/${schoolClass.id}`;
    const { body: sheet } = await teacher.session.get(sheetUrl).expect(200);
    expect(sheet.rows).toEqual([
      expect.objectContaining({ result: '15', status: 'draft', comment: null }),
    ]);
    await assistant.session
      .put(sheetUrl)
      .send({ comments: [{ studentId: student.id, comment: 'Brouillon' }] })
      .expect(200);
    await teacher.session
      .put(sheetUrl)
      .send({
        comments: [
          { studentId: student.id, comment: 'Bon trimestre, à approfondir.' },
        ],
      })
      .expect(200);

    const { body: cards } = await coordinator.session
      .get(`/api/v1/reports/terms/${term.id}/cards`)
      .expect(200);
    expect(cards).toEqual([
      expect.objectContaining({ status: 'draft', entries: 1, commented: 1 }),
    ]);
    await teacher.session
      .post(`/api/v1/reports/cards/${cards[0].id}/approve`)
      .expect(403);
    await coordinator.session
      .post(`/api/v1/reports/cards/${cards[0].id}/return`)
      .send({ note: 'Précisez les points à travailler.' })
      .expect(200);
    const { body: returned } = await teacher.session.get(sheetUrl).expect(200);
    expect(returned.rows[0]).toMatchObject({
      status: 'returned',
      returnNote: 'Précisez les points à travailler.',
    });
    await teacher.session
      .put(sheetUrl)
      .send({
        comments: [
          {
            studentId: student.id,
            comment: 'Bon trimestre. À travailler : les fractions.',
          },
        ],
      })
      .expect(200);
    await coordinator.session
      .put(`/api/v1/reports/cards/${cards[0].id}/general-comment`)
      .send({ generalComment: 'Trimestre réussi.' })
      .expect(200);
    const { body: approved } = await coordinator.session
      .post(`/api/v1/reports/cards/${cards[0].id}/approve`)
      .expect(200);
    expect(approved).toMatchObject({
      status: 'approved',
      entries: [{ resultValue: '15', reportingScaleName: 'Marks' }],
      attendance: { late: 1 },
    });
    await teacher.session
      .put(sheetUrl)
      .send({ comments: [{ studentId: student.id, comment: 'Too late' }] })
      .expect(409);

    expect(
      await app
        .get(ReportsService)
        .generate({ schoolId: school.id, cardId: cards[0].id }),
    ).toBe(true);

    const { body: files } = await parent.session
      .get(`/api/v1/students/${student.id}/files`)
      .expect(200);
    expect(files).toEqual([
      expect.objectContaining({
        title: 'Bulletin – Term 1',
        visibleToFamily: true,
      }),
    ]);
    const { body: link } = await parent.session
      .get(`/api/v1/files/${files[0].file.id}/download`)
      .expect(200);
    const pdf = Buffer.from(await (await fetch(link.url)).arrayBuffer());
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');

    await deliverMail(app);
    const mail = mailbox(app)
      .filter({ to: parentEmail })
      .filter((sent) => sent.template === 'notice')
      .map((sent) => sent.subject);
    expect(mail).toEqual([
      'Nouvelle note : Fractions',
      'Bulletin de Amira Haddad : Term 1',
    ]);

    const { body: portfolio } = await parent.session
      .get(`/api/v1/portfolio/students/${student.id}`)
      .expect(200);
    expect(portfolio).toMatchObject({
      term: { name: 'Term 1' },
      attendance: { sessions: 1, late: 1 },
      grades: [
        {
          class: { code: 'M7A' },
          result: { value: '15' },
          latest: { title: 'Fractions', value: '15' },
        },
      ],
      reports: [{ term: 'Term 1', fileId: files[0].file.id }],
    });
    expect(JSON.stringify(portfolio)).not.toMatch(/invoice|balance|fee/i);
    expect(app.get(FilesService)).toBeTruthy();
  }, 120_000);

  it('holds student work for approval before the family sees it, and takes comments and reflections (PRT-2/3/4)', async () => {
    const { schoolClass, teacher, student, studentMember, parent } =
      await setUp();
    const { body: item } = await studentMember.session
      .post('/api/v1/portfolio/items')
      .send({
        studentId: student.id,
        kind: 'text',
        title: 'My poem',
        body: text('Roses are red'),
        tags: ['Poetry', 'poetry'],
      })
      .expect(201);
    expect(item).toMatchObject({ status: 'pending', tags: ['poetry'] });

    const familyView = async () =>
      (
        await parent.session
          .get(`/api/v1/portfolio/students/${student.id}/items`)
          .expect(200)
      ).body.items;
    expect(await familyView()).toEqual([]);
    await studentMember.session
      .post(`/api/v1/portfolio/items/${item.id}/approve`)
      .expect(403);
    await teacher.session
      .post(`/api/v1/portfolio/items/${item.id}/approve`)
      .expect(204);
    expect(await familyView()).toEqual([
      expect.objectContaining({ title: 'My poem', status: 'approved' }),
    ]);

    await teacher.session
      .post(`/api/v1/portfolio/items/${item.id}/comments`)
      .send({ body: 'Lovely imagery.' })
      .expect(201);
    const { body: reflected } = await studentMember.session
      .post(`/api/v1/portfolio/items/${item.id}/comments`)
      .send({ body: 'I would add a second verse.' })
      .expect(201);
    expect(
      reflected.comments.map((comment: { kind: string }) => comment.kind),
    ).toEqual(['comment', 'reflection']);
    await parent.session
      .post(`/api/v1/portfolio/items/${item.id}/comments`)
      .send({ body: 'x' })
      .expect(403);

    const { body: classPost } = await teacher.session
      .post('/api/v1/portfolio/items')
      .send({
        classId: schoolClass.id,
        kind: 'link',
        title: 'Class blog',
        url: 'https://example.org/blog',
      })
      .expect(201);
    expect(classPost.status).toBe('approved');
    const { body: classItems } = await parent.session
      .get(`/api/v1/portfolio/classes/${schoolClass.id}/items`)
      .expect(200);
    expect(classItems.items).toEqual([
      expect.objectContaining({ title: 'Class blog' }),
    ]);
    await studentMember.session
      .post('/api/v1/portfolio/items')
      .send({
        classId: schoolClass.id,
        kind: 'link',
        title: 'Mine',
        url: 'https://example.org',
      })
      .expect(403);
  });

  it('keeps portfolio images to those who may see the item', async () => {
    const { school, student, studentMember, parent, teacher } = await setUp();
    const content = 'fake png bytes';
    const { body: session } = await studentMember.session
      .post('/api/v1/files/uploads')
      .send({
        name: 'drawing.png',
        contentType: 'image/png',
        size: content.length,
        target: { type: 'portfolio', studentId: student.id },
      })
      .expect(201);
    await fetch(session.uploadUrl, {
      method: 'PUT',
      body: content,
      headers: { 'content-type': 'image/png' },
    });
    await studentMember.session
      .post(`/api/v1/files/${session.file.id}/complete`)
      .expect(200);
    await app
      .get(FilesService)
      .scan({ schoolId: school.id, fileId: session.file.id });

    const { body: item } = await studentMember.session
      .post('/api/v1/portfolio/items')
      .send({
        studentId: student.id,
        kind: 'image',
        title: 'Drawing',
        fileId: session.file.id,
      })
      .expect(201);
    await parent.session
      .get(`/api/v1/files/${session.file.id}/download`)
      .expect(403);
    await teacher.session
      .post(`/api/v1/portfolio/items/${item.id}/approve`)
      .expect(204);
    await parent.session
      .get(`/api/v1/files/${session.file.id}/download`)
      .expect(200);
  });
});
