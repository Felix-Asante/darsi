import type { INestApplication } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { v7 as uuidv7 } from 'uuid';
import { TenantTransactions } from '../src/common/tenancy/tenant-transactions.js';
import { FileQuota } from '../src/modules/files/entities/files.entities.js';
import { FilesService } from '../src/modules/files/files.service.js';
import { ObjectStorage } from '../src/modules/files/object-storage.service.js';
import { createTestApp } from './support/create-test-app.js';
import {
  type Agent,
  addMember,
  createSchool,
  deliverMail,
  uniqueEmail,
} from './support/identity.js';

const EICAR =
  'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

describe('Files, class drive and student files (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    await app.get(ObjectStorage).ensureBucket();
  });

  afterAll(async () => {
    await app.close();
  });

  /** Uploads like the browser does, then runs the scan as the worker would. */
  async function upload(
    agent: Agent,
    schoolId: string,
    name: string,
    content: string,
    target: object,
    contentType = 'text/plain',
  ) {
    const { body: session } = await agent
      .post('/api/v1/files/uploads')
      .send({ name, contentType, size: Buffer.byteLength(content), target })
      .expect(201);
    const put = await fetch(session.uploadUrl, {
      method: 'PUT',
      body: content,
      headers: { 'content-type': contentType },
    });
    expect(put.status).toBe(200);
    await agent.post(`/api/v1/files/${session.file.id}/complete`).expect(200);
    const status = await app
      .get(FilesService)
      .scan({ schoolId, fileId: session.file.id });
    return { id: session.file.id as string, status };
  }

  async function setUp() {
    const school = await createSchool(app);
    const post = async (path: string, payload: object) =>
      (await school.admin.post(`/api/v1${path}`).send(payload).expect(201))
        .body;
    const year = await post('/academics/years', {
      name: 'Year',
      startsOn: '2026-09-01',
      endsOn: '2027-07-02',
    });
    const schoolClass = await post('/academics/classes', {
      academicYearId: year.id,
      code: '7A',
      name: 'Class 7A',
    });
    const teacher = await addMember(app, school, ['teacher']);
    const assistant = await addMember(app, school, ['teaching_assistant']);
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
    const student = await post('/students', {
      studentNumber: `S-${uuidv7().slice(-6)}`,
      firstName: 'Amira',
      lastName: 'Haddad',
      email: studentEmail,
    });
    const otherChild = await post('/students', {
      studentNumber: `S-${uuidv7().slice(-6)}`,
      firstName: 'Lucas',
      lastName: 'Martin',
    });
    await post(`/academics/classes/${schoolClass.id}/students`, {
      studentIds: [student.id],
    });
    const parentEmail = uniqueEmail('parent');
    const guardian = await post('/guardians', {
      firstName: 'Leila',
      lastName: 'Haddad',
      email: parentEmail,
    });
    await post(`/students/${student.id}/guardians`, {
      guardianId: guardian.id,
      relationship: 'mother',
    });
    const strangerEmail = uniqueEmail('stranger');
    const strangerGuardian = await post('/guardians', {
      firstName: 'Paul',
      lastName: 'Martin',
      email: strangerEmail,
    });
    await post(`/students/${otherChild.id}/guardians`, {
      guardianId: strangerGuardian.id,
      relationship: 'father',
    });
    const studentMember = await addMember(
      app,
      school,
      ['student'],
      studentEmail,
    );
    const parent = await addMember(app, school, ['guardian'], parentEmail);
    const stranger = await addMember(app, school, ['guardian'], strangerEmail);
    await deliverMail(app);
    return {
      school,
      schoolClass,
      teacher,
      assistant,
      student,
      studentMember,
      parent,
      stranger,
      post,
    };
  }

  it('shows each file only to its audience, and stops a guardian’s access when the child leaves the class (DRV-3)', async () => {
    const {
      school,
      schoolClass,
      teacher,
      assistant,
      student,
      studentMember,
      parent,
      stranger,
    } = await setUp();
    const { body: folder } = await teacher.session
      .post(`/api/v1/drive/classes/${schoolClass.id}/folders`)
      .send({ name: 'Homework', visibility: ['student', 'guardian'] })
      .expect(201);
    const shared = await upload(
      assistant.session,
      school.id,
      'week 1.txt',
      'Read chapter 3',
      {
        type: 'drive',
        classId: schoolClass.id,
        parentId: folder.id,
      },
    );
    expect(shared.status).toBe('available');
    const staffOnly = await upload(
      teacher.session,
      school.id,
      'answers.txt',
      'Secret answers',
      {
        type: 'drive',
        classId: schoolClass.id,
        visibility: [],
      },
    );

    const { body: top } = await studentMember.session
      .get(`/api/v1/drive/classes/${schoolClass.id}`)
      .expect(200);
    expect(top.items.map((item: { name: string }) => item.name)).toEqual([
      'Homework',
    ]);
    const { body: inside } = await parent.session
      .get(`/api/v1/drive/classes/${schoolClass.id}?folderId=${folder.id}`)
      .expect(200);
    expect(inside).toMatchObject({
      path: [{ name: 'Homework' }],
      items: [
        { name: 'week 1.txt', file: { status: 'available', preview: 'text' } },
      ],
    });

    const { body: link } = await parent.session
      .get(`/api/v1/files/${shared.id}/download`)
      .expect(200);
    expect(await (await fetch(link.url)).text()).toBe('Read chapter 3');
    await studentMember.session
      .get(`/api/v1/files/${staffOnly.id}/download`)
      .expect(403);
    await stranger.session
      .get(`/api/v1/drive/classes/${schoolClass.id}`)
      .expect(403);
    await stranger.session
      .get(`/api/v1/files/${shared.id}/download`)
      .expect(403);

    await school.admin
      .delete(
        `/api/v1/academics/classes/${schoolClass.id}/students/${student.id}`,
      )
      .expect(204);
    await parent.session.get(`/api/v1/files/${shared.id}/download`).expect(403);
    await parent.session
      .get(`/api/v1/drive/classes/${schoolClass.id}`)
      .expect(403);
  });

  it('rejects an EICAR test file and tells the uploader (DRV-8)', async () => {
    const { school, schoolClass, teacher } = await setUp();
    const infected = await upload(
      teacher.session,
      school.id,
      'virus.txt',
      EICAR,
      { type: 'drive', classId: schoolClass.id },
    );
    expect(infected.status).toBe('rejected');
    const { body } = await teacher.session
      .get(`/api/v1/files/${infected.id}/download`)
      .expect(409);
    expect(body.code).toBe('file_not_ready');
    const { body: inbox } = await teacher.session
      .get('/api/v1/notifications')
      .expect(200);
    expect(inbox.items[0]).toMatchObject({
      type: 'file.rejected',
      params: { name: 'virus.txt' },
    });
  });

  it('checks type, size, quota and the upload itself', async () => {
    const { school, schoolClass, teacher } = await setUp();
    const target = { type: 'drive', classId: schoolClass.id };
    const { body: exe } = await teacher.session
      .post('/api/v1/files/uploads')
      .send({
        name: 'tool.exe',
        contentType: 'application/x-msdownload',
        size: 10,
        target,
      })
      .expect(422);
    expect(exe).toMatchObject({
      code: 'file_not_allowed',
      errors: [{ field: 'name', codes: ['typeNotAllowed'] }],
    });

    const { body: session } = await teacher.session
      .post('/api/v1/files/uploads')
      .send({ name: 'notes.txt', contentType: 'text/plain', size: 5, target })
      .expect(201);
    await teacher.session
      .post(`/api/v1/files/${session.file.id}/complete`)
      .expect(422);
    const wrongSize = await fetch(session.uploadUrl, {
      method: 'PUT',
      body: 'too long',
      headers: { 'content-type': 'text/plain' },
    });
    // Whatever the storage server allows, a file of the wrong size is never accepted.
    if (wrongSize.ok)
      await teacher.session
        .post(`/api/v1/files/${session.file.id}/complete`)
        .expect(422);

    const txHost =
      app.get<TransactionHost<TransactionalAdapterTypeOrm>>(TransactionHost);
    await app
      .get(TenantTransactions)
      .runInSchool(school.id, () =>
        txHost.tx.save(txHost.tx.create(FileQuota, { quotaBytes: 6 })),
      );
    const { body: full } = await teacher.session
      .post('/api/v1/files/uploads')
      .send({ name: 'more.txt', contentType: 'text/plain', size: 5, target })
      .expect(409);
    expect(full.code).toBe('quota_exceeded');
    const { body: usage } = await school.admin
      .get('/api/v1/files/usage')
      .expect(200);
    expect(usage).toEqual({ usedBytes: 5, quotaBytes: 6 });
  });

  it('lets assistants manage but only teachers delete (DRV-2)', async () => {
    const { school, schoolClass, teacher, assistant } = await setUp();
    const file = await upload(assistant.session, school.id, 'draft.txt', 'v1', {
      type: 'drive',
      classId: schoolClass.id,
    });
    const { body: list } = await assistant.session
      .get(`/api/v1/drive/classes/${schoolClass.id}`)
      .expect(200);
    const item = list.items[0];
    await assistant.session
      .patch(`/api/v1/drive/items/${item.id}`)
      .send({ name: 'final.txt' })
      .expect(200);
    await assistant.session
      .delete(`/api/v1/drive/items/${item.id}`)
      .expect(403);
    await teacher.session.delete(`/api/v1/drive/items/${item.id}`).expect(204);
    await teacher.session.get(`/api/v1/files/${file.id}/download`).expect(404);
  });

  it('keeps student files staff-only until shared with the family (RPT-7)', async () => {
    const { school, student, parent } = await setUp();
    const report = await upload(
      school.admin,
      school.id,
      'report.txt',
      'Term 1 report',
      {
        type: 'student',
        studentId: student.id,
        title: 'Term 1 report',
      },
    );
    const { body: staffView } = await school.admin
      .get(`/api/v1/students/${student.id}/files`)
      .expect(200);
    expect(staffView).toEqual([
      expect.objectContaining({
        title: 'Term 1 report',
        visibleToFamily: false,
      }),
    ]);
    expect(
      await parent.session
        .get(`/api/v1/students/${student.id}/files`)
        .expect(200)
        .then((r) => r.body),
    ).toEqual([]);
    await parent.session.get(`/api/v1/files/${report.id}/download`).expect(403);

    await school.admin
      .patch(`/api/v1/student-files/${staffView[0].id}`)
      .send({ visibleToFamily: true })
      .expect(204);
    await parent.session.get(`/api/v1/files/${report.id}/download`).expect(200);
  });

  it('takes file submissions and attaches drive files to an assessment by reference (ASM-10, DRV-10)', async () => {
    const {
      school,
      schoolClass,
      teacher,
      studentMember,
      parent,
      stranger,
      post,
    } = await setUp();
    const scale = await post('/grading/scales', {
      name: 'Marks',
      preset: 'french_20',
    });
    const { body: assessment } = await teacher.session
      .post(`/api/v1/assessment/classes/${schoolClass.id}/assessments`)
      .send({ title: 'Essay', kind: 'summative', scaleId: scale.id })
      .expect(201);

    const work = await upload(
      studentMember.session,
      school.id,
      'essay.txt',
      'My essay',
      { type: 'submission', assessmentId: assessment.id },
    );
    const { body: sheet } = await teacher.session
      .get(`/api/v1/assessment/assessments/${assessment.id}/grades`)
      .expect(200);
    expect(sheet.submissions[0]).toMatchObject({ fileId: work.id });
    await teacher.session.get(`/api/v1/files/${work.id}/download`).expect(200);
    await parent.session.get(`/api/v1/files/${work.id}/download`).expect(200);
    await stranger.session.get(`/api/v1/files/${work.id}/download`).expect(403);

    const brief = await upload(
      teacher.session,
      school.id,
      'brief.txt',
      'Write 500 words',
      {
        type: 'drive',
        classId: schoolClass.id,
        visibility: ['student'],
      },
    );
    const { body: top } = await teacher.session
      .get(`/api/v1/drive/classes/${schoolClass.id}`)
      .expect(200);
    const item = top.items.find(
      (entry: { file: { id: string } | null }) => entry.file?.id === brief.id,
    );
    await teacher.session
      .put('/api/v1/drive/attachments')
      .send({
        targetType: 'assessment',
        targetId: assessment.id,
        driveItemIds: [item.id],
      })
      .expect(200);
    const query = `targetType=assessment&targetId=${assessment.id}`;
    expect(
      (
        await studentMember.session
          .get(`/api/v1/drive/attachments?${query}`)
          .expect(200)
      ).body,
    ).toHaveLength(1);
    expect(
      (
        await parent.session
          .get(`/api/v1/drive/attachments?${query}`)
          .expect(200)
      ).body,
    ).toHaveLength(0);
  });
});
