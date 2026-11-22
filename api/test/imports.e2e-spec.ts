import type { INestApplication } from '@nestjs/common';
import { ImportsService } from '../src/modules/imports/imports.service.js';
import { createTestApp } from './support/create-test-app.js';
import {
  addMember,
  createSchool,
  type CreatedSchool,
} from './support/identity.js';

describe('CSV imports (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  /** Uploads like the web app, then runs the job as the worker would. */
  async function runImport(
    school: CreatedSchool,
    kind: string,
    content: string,
  ) {
    const { body: queued } = await school.admin
      .post('/api/v1/imports')
      .send({ kind, fileName: `${kind}.csv`, content })
      .expect(201);
    expect(queued.status).toBe('queued');
    await app
      .get(ImportsService)
      .process({ jobId: queued.id, schoolId: school.id });
    const { body: job } = await school.admin
      .get(`/api/v1/imports/${queued.id}`)
      .expect(200);
    return job;
  }

  async function setUp() {
    const school = await createSchool(app);
    await school.admin
      .post('/api/v1/academics/years')
      .send({ name: '2026–2027', startsOn: '2026-09-01', endsOn: '2027-07-02' })
      .expect(201);
    const { body: division } = await school.admin
      .post('/api/v1/academics/divisions')
      .send({ name: 'Middle' })
      .expect(201);
    await school.admin
      .post('/api/v1/academics/grade-levels')
      .send({ divisionId: division.id, name: 'Grade 7' })
      .expect(201);
    await school.admin
      .post('/api/v1/academics/subjects')
      .send({ code: 'MATH', name: 'Mathematics' })
      .expect(201);
    return school;
  }

  it('imports 500 students in under 30 seconds, reports bad rows and creates no duplicates on re-import', async () => {
    const school = await setUp();
    const lines = [
      'student_number,first_name,last_name,date_of_birth,grade_level',
    ];
    for (let index = 1; index <= 500; index += 1) {
      lines.push(
        `S${String(index).padStart(4, '0')},Student,Number ${index},2013-05-${String((index % 28) + 1).padStart(2, '0')},Grade 7`,
      );
    }
    lines.push('S9998,No,Birthday,2013-02-30,Grade 7');
    lines.push(',Missing,Number,,');
    lines.push('S9999,Unknown,Grade,,Grade 99');
    const csv = lines.join('\n');

    const started = Date.now();
    const first = await runImport(school, 'students', csv);
    expect(Date.now() - started).toBeLessThan(30_000);

    expect(first).toMatchObject({
      status: 'completed',
      totalRows: 503,
      importedRows: 500,
      failedRows: 3,
    });
    expect(first.errors).toEqual([
      { row: 502, field: 'date_of_birth', code: 'isCalendarDate' },
      { row: 503, field: 'student_number', code: 'matches' },
      { row: 504, field: 'grade_level', code: 'gradeLevelNotFound' },
    ]);

    const again = await runImport(school, 'students', csv);
    expect(again.importedRows).toBe(500);
    const { body: page } = await school.admin
      .get('/api/v1/students?limit=200&search=Number')
      .expect(200);
    let total = page.items.length;
    let cursor = page.nextCursor;
    while (cursor) {
      const { body: next } = await school.admin
        .get(`/api/v1/students?limit=200&search=Number&cursor=${cursor}`)
        .expect(200);
      total += next.items.length;
      cursor = next.nextCursor;
    }
    expect(total).toBe(500);
  }, 120_000);

  it('refuses a file without the required columns before queueing it', async () => {
    const school = await setUp();
    const { body } = await school.admin
      .post('/api/v1/imports')
      .send({
        kind: 'students',
        fileName: 'wrong.csv',
        content: 'name,birthday\nAmira,2013-01-01',
      })
      .expect(400);

    expect(body.code).toBe('missing_columns');
    expect(body.errors.map((error: { field: string }) => error.field)).toEqual([
      'student_number',
      'first_name',
      'last_name',
    ]);
  });

  it('imports guardians, classes with their teachers, and enrolments', async () => {
    const school = await setUp();
    const teacher = await addMember(app, school, ['teacher']);
    await runImport(
      school,
      'students',
      'student_number;first_name;last_name\nA1;Amira;Haddad\nA2;Yasmine;Haddad',
    );

    const guardians = await runImport(
      school,
      'guardians',
      `email,first_name,last_name,preferred_locale,student_numbers,relationship\nleila@example.test,Leila,Haddad,FR,A1;A2,Mother\nghost@example.test,Ghost,Parent,,Z9,`,
    );
    expect(guardians.errors).toEqual([
      { row: 3, field: 'student_numbers', code: 'studentNotFound' },
    ]);

    const classes = await runImport(
      school,
      'classes',
      `code,name,subject_code,grade_level,teacher_emails\nM7A,Mathematics 7A,MATH,Grade 7,${teacher.email}\nM7B,Mathematics 7B,MATH,Grade 7,nobody@example.test`,
    );
    expect(classes).toMatchObject({
      importedRows: 1,
      errors: [{ row: 3, field: 'teacher_emails', code: 'notAMember' }],
    });

    const enrolments = await runImport(
      school,
      'enrolments',
      'student_number,class_code\nA1,M7A\nA2,M7A\nA1,NOPE',
    );
    expect(enrolments).toMatchObject({
      importedRows: 2,
      errors: [{ row: 4, field: 'class_code', code: 'classNotFound' }],
    });

    const { body: mine } = await teacher.session
      .get('/api/v1/academics/classes')
      .expect(200);
    expect(mine).toEqual([
      expect.objectContaining({
        code: 'M7A',
        subject: expect.objectContaining({ code: 'MATH' }),
      }),
    ]);
    const { body: roster } = await teacher.session
      .get(`/api/v1/academics/classes/${mine[0].id}/students`)
      .expect(200);
    expect(
      roster.map((student: { firstName: string }) => student.firstName).sort(),
    ).toEqual(['Amira', 'Yasmine']);

    const { body: page } = await school.admin
      .get('/api/v1/students?search=A1')
      .expect(200);
    const { body: profile } = await school.admin
      .get(`/api/v1/students/${page.items[0].id}`)
      .expect(200);
    expect(profile.guardians).toEqual([
      expect.objectContaining({
        email: 'leila@example.test',
        relationship: 'mother',
      }),
    ]);
    expect(profile.siblings).toHaveLength(1);
  });

  it('imports a standards hierarchy, creating the framework', async () => {
    const school = await setUp();
    const job = await runImport(
      school,
      'standards',
      'framework_code,framework_name,code,description,parent_code\nCCSS-M,Common Core Math,7.RP,Ratios and proportional relationships,\nCCSS-M,,7.RP.A.1,Compute unit rates,7.RP\nCCSS-M,,7.X,Orphan,NOPE',
    );
    expect(job).toMatchObject({
      importedRows: 2,
      errors: [{ row: 4, field: 'parent_code', code: 'notFound' }],
    });

    const { body: frameworks } = await school.admin
      .get('/api/v1/curriculum/frameworks')
      .expect(200);
    expect(frameworks).toEqual([
      expect.objectContaining({
        code: 'CCSS-M',
        name: 'Common Core Math',
        standardCount: 2,
      }),
    ]);
  });

  it('places classes on the timetable by period name and rotation day', async () => {
    const school = await setUp();
    const { body: schedule } = await school.admin
      .post('/api/v1/timetables/bell-schedules')
      .send({ name: 'Bells', rotationKind: 'weekly', rotationLength: 2 })
      .expect(201);
    await school.admin
      .post(`/api/v1/timetables/bell-schedules/${schedule.id}/periods`)
      .send({ name: 'P1', startsAt: '08:30', endsAt: '09:25' })
      .expect(201);
    await runImport(
      school,
      'classes',
      'code,name,subject_code\nM7A,Mathematics 7A,MATH',
    );

    const csv =
      'class_code,day,period,room\nM7A,1,P1,B12\nM7A,6,p1,\nM7A,11,P1,\nM7A,2,P9,\nNOPE,1,P1,';
    const job = await runImport(school, 'timetable', csv);
    expect(job).toMatchObject({
      importedRows: 2,
      errors: [
        { row: 4, field: 'day', code: 'dayOutOfRange' },
        { row: 5, field: 'period', code: 'periodNotFound' },
        { row: 6, field: 'class_code', code: 'classNotFound' },
      ],
    });
    await runImport(
      school,
      'timetable',
      'class_code,day,period,room\nM7A,1,P1,Lab 1',
    );

    const { body: classes } = await school.admin
      .get('/api/v1/academics/classes')
      .expect(200);
    const { body: timetable } = await school.admin
      .get(`/api/v1/timetables/classes/${classes[0].id}/slots`)
      .expect(200);
    expect(
      timetable.slots.map((slot: { cycleDay: number; room: string | null }) => [
        slot.cycleDay,
        slot.room,
      ]),
    ).toEqual([
      [1, 'Lab 1'],
      [6, null],
    ]);
  });

  it('is only for those who manage people and classes', async () => {
    const school = await setUp();
    const teacher = await addMember(app, school, ['teacher']);
    await teacher.session
      .post('/api/v1/imports')
      .send({
        kind: 'students',
        fileName: 'x.csv',
        content: 'student_number,first_name,last_name\nX,Y,Z',
      })
      .expect(403);
  });
});
