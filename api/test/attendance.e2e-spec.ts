import type { INestApplication } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { v7 as uuidv7 } from 'uuid';
import { addDays, todayIn } from '../src/common/dates/calendar-date.js';
import { TenantTransactions } from '../src/common/tenancy/tenant-transactions.js';
import { AttendanceService } from '../src/modules/attendance/attendance.service.js';
import { AttendanceSession } from '../src/modules/attendance/entities/attendance.entities.js';
import { AuditEvent } from '../src/modules/audit/audit-event.entity.js';
import { createTestApp } from './support/create-test-app.js';
import {
  addMember,
  createSchool,
  deliverMail,
  mailbox,
  uniqueEmail,
} from './support/identity.js';
import { expectTenantIsolation } from './support/tenant-isolation.js';

describe('Attendance (e2e)', () => {
  let app: INestApplication;
  const today = todayIn('Europe/Paris');
  const yesterday = addDays(today, -1);

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function setUp() {
    const school = await createSchool(app);
    const post = async (path: string, body: object) =>
      (await school.admin.post(`/api/v1${path}`).send(body).expect(201)).body;
    await post('/academics/years', {
      name: 'Year',
      startsOn: addDays(today, -60),
      endsOn: addDays(today, 200),
    });
    const year = (await school.admin.get('/api/v1/academics/years').expect(200))
      .body[0];
    const schoolClass = await post('/academics/classes', {
      academicYearId: year.id,
      code: '7A',
      name: 'Class 7A',
    });
    const teacher = await addMember(app, school, ['teacher']);
    await school.admin
      .put(`/api/v1/academics/classes/${schoolClass.id}/staff`)
      .send({ staff: [{ userId: teacher.userId, role: 'teacher' }] })
      .expect(200);

    const students: { id: string }[] = [];
    for (let index = 0; index < 30; index += 1) {
      students.push(
        await post('/students', {
          studentNumber: `A-${uuidv7().slice(-8)}`,
          firstName: `Kid${index}`,
          lastName: 'Martin',
        }),
      );
    }
    await post(`/academics/classes/${schoolClass.id}/students`, {
      studentIds: students.map((student) => student.id),
    });

    const parentEmail = uniqueEmail('parent');
    const guardian = await post('/guardians', {
      firstName: 'Claire',
      lastName: 'Martin',
      email: parentEmail,
      preferredLocale: 'fr',
    });
    await post(`/students/${students[0].id}/guardians`, {
      guardianId: guardian.id,
      relationship: 'mother',
    });
    await post(`/students/${students[1].id}/guardians`, {
      guardianId: guardian.id,
      relationship: 'mother',
    });
    const parent = await addMember(app, school, ['guardian'], parentEmail);
    await deliverMail(app);
    return { school, schoolClass, teacher, students, parent, parentEmail };
  }

  const sessionId = async (schoolId: string, classId: string, date: string) => {
    const txHost =
      app.get<TransactionHost<TransactionalAdapterTypeOrm>>(TransactionHost);
    const session = await app
      .get(TenantTransactions)
      .runInSchool(schoolId, () =>
        txHost.tx.findOneByOrFail(AttendanceSession, { classId, date }),
      );
    return session.id;
  };

  it('takes a class of 30 by marking exceptions, and emails guardians about unexplained absences in their language', async () => {
    const { school, schoolClass, teacher, students, parent, parentEmail } =
      await setUp();
    const url = `/api/v1/attendance/classes/${schoolClass.id}`;

    const { body: fresh } = await teacher.session
      .get(`${url}?date=${today}`)
      .expect(200);
    expect(fresh.students).toHaveLength(30);
    expect(
      fresh.students.every(
        (entry: { status: string }) => entry.status === 'present',
      ),
    ).toBe(true);

    const started = performance.now();
    const { body: taken } = await teacher.session
      .put(url)
      .send({
        date: today,
        records: [
          { studentId: students[0].id, status: 'absent' },
          { studentId: students[1].id, status: 'absent' },
          { studentId: students[2].id, status: 'late' },
        ],
      })
      .expect(200);
    expect(performance.now() - started).toBeLessThan(2000);
    expect(
      taken.students.filter(
        (entry: { status: string }) => entry.status !== 'present',
      ),
    ).toHaveLength(3);

    // The guardian explains one child's absence before the delay runs out.
    await parent.session
      .post(`/api/v1/attendance/students/${students[1].id}/reasons`)
      .send({ date: today, reason: 'Rendez-vous chez le dentiste' })
      .expect(201);
    await parent.session
      .post(`/api/v1/attendance/students/${students[5].id}/reasons`)
      .send({ date: today, reason: 'x' })
      .expect(403);

    const notified = await app.get(AttendanceService).notifyUnexplained({
      schoolId: school.id,
      sessionId: await sessionId(school.id, schoolClass.id, today),
    });
    expect(notified).toBe(1);
    await deliverMail(app);
    const mails = mailbox(app)
      .filter({ to: parentEmail })
      .filter((mail) => mail.template === 'notice');
    expect(mails).toHaveLength(1);
    expect(mails[0].subject).toBe('Kid0 Martin a été noté(e) absent(e)');
    expect(mails[0].html?.replace(/\s+/g, ' ')).toContain('en Class 7A le');

    const { body: inbox } = await parent.session
      .get('/api/v1/notifications')
      .expect(200);
    expect(inbox.items[0]).toMatchObject({ type: 'attendance.absence' });

    // Running the check again sends nothing more.
    expect(
      await app.get(AttendanceService).notifyUnexplained({
        schoolId: school.id,
        sessionId: await sessionId(school.id, schoolClass.id, today),
      }),
    ).toBe(0);
  });

  it('respects notification preferences', async () => {
    const { school, schoolClass, teacher, students, parent, parentEmail } =
      await setUp();
    await parent.session
      .put('/api/v1/notifications/preferences')
      .send({ type: 'attendance.absence', inApp: true, email: false })
      .expect(204);
    await teacher.session
      .put(`/api/v1/attendance/classes/${schoolClass.id}`)
      .send({
        date: today,
        records: [{ studentId: students[0].id, status: 'absent' }],
      })
      .expect(200);
    await app.get(AttendanceService).notifyUnexplained({
      schoolId: school.id,
      sessionId: await sessionId(school.id, schoolClass.id, today),
    });
    await deliverMail(app);
    expect(
      mailbox(app)
        .filter({ to: parentEmail })
        .filter((mail) => mail.template === 'notice'),
    ).toHaveLength(0);
    const { body: preferences } = await parent.session
      .get('/api/v1/notifications/preferences')
      .expect(200);
    expect(preferences).toContainEqual({
      type: 'attendance.absence',
      inApp: true,
      email: false,
    });
  });

  it('audits edits after the day closes, refuses holidays and the future, and reports with CSV export', async () => {
    const { school, schoolClass, teacher, students } = await setUp();
    const url = `/api/v1/attendance/classes/${schoolClass.id}`;
    await teacher.session
      .put(url)
      .send({ date: yesterday, records: [] })
      .expect(200);
    await teacher.session
      .put(url)
      .send({
        date: yesterday,
        records: [
          { studentId: students[3].id, status: 'excused', reason: 'Sick note' },
        ],
      })
      .expect(200);
    const txHost =
      app.get<TransactionHost<TransactionalAdapterTypeOrm>>(TransactionHost);
    const changes = await app
      .get(TenantTransactions)
      .runInSchool(school.id, () =>
        txHost.tx.find(AuditEvent, { where: { action: 'attendance.changed' } }),
      );
    expect(changes).toEqual([
      expect.objectContaining({
        diff: {
          status: { before: 'present', after: 'excused' },
          reason: { before: null, after: 'Sick note' },
        },
      }),
    ]);

    await teacher.session
      .put(url)
      .send({ date: addDays(today, 1), records: [] })
      .expect(400);
    await school.admin
      .post('/api/v1/calendar/events')
      .send({
        title: 'Holiday',
        kind: 'holiday',
        startsOn: addDays(today, -2),
        audience: 'school',
      })
      .expect(201);
    const { body: holiday } = await teacher.session
      .put(url)
      .send({ date: addDays(today, -2), records: [] })
      .expect(409);
    expect(holiday.code).toBe('no_school');

    const { body: summary } = await school.admin
      .get(
        `/api/v1/attendance/students/${students[3].id}/summary?from=${addDays(today, -7)}&to=${today}`,
      )
      .expect(200);
    expect(summary).toMatchObject({
      sessions: 1,
      excused: 1,
      rate: null,
      exceptions: [{ date: yesterday, status: 'excused' }],
    });

    const range = `from=${addDays(today, -7)}&to=${today}&classId=${schoolClass.id}`;
    const { body: report } = await school.admin
      .get(`/api/v1/attendance/report?${range}`)
      .expect(200);
    expect(report).toHaveLength(30);
    const csv = await school.admin
      .get(`/api/v1/attendance/report.csv?${range}`)
      .expect(200)
      .expect('content-type', /text\/csv/);
    expect(csv.text.split('\r\n')[0]).toBe(
      'student_number,last_name,first_name,grade_level,sessions,present,late,absent,excused,rate',
    );
    await teacher.session.get(`/api/v1/attendance/report?${range}`).expect(403);
  });

  it('needs a scheduled period in per-period mode', async () => {
    const { school, schoolClass, teacher } = await setUp();
    await school.admin
      .put('/api/v1/attendance/settings')
      .send({ mode: 'period', notifyAfterMinutes: 30 })
      .expect(200);
    const url = `/api/v1/attendance/classes/${schoolClass.id}`;
    const { body } = await teacher.session
      .put(url)
      .send({ date: today, records: [] })
      .expect(400);
    expect(body.code).toBe('period_required');
    await teacher.session
      .put(url)
      .send({ date: today, periodId: uuidv7(), records: [] })
      .expect(422);
  });

  it('isolates attendance settings between schools', async () => {
    const txHost =
      app.get<TransactionHost<TransactionalAdapterTypeOrm>>(TransactionHost);
    await expectTenantIsolation(app, {
      table: 'attendance_settings',
      insertRow: async () => {
        const id = uuidv7();
        await txHost.tx.query(
          `INSERT INTO attendance_settings (id) VALUES ($1)`,
          [id],
        );
        return id;
      },
    });
  });
});
