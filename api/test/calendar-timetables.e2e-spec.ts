import type { INestApplication } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { v7 as uuidv7 } from 'uuid';
import { createTestApp } from './support/create-test-app.js';
import {
  addMember,
  createSchool,
  deliverMail,
  uniqueEmail,
} from './support/identity.js';
import { expectTenantIsolation } from './support/tenant-isolation.js';

describe('Calendar and timetables (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  /** Grade 7 in a middle school with a Week A / Week B timetable, one class, its teacher and one student. */
  async function setUp() {
    const school = await createSchool(app);
    const post = async (path: string, body: object) =>
      (await school.admin.post(`/api/v1${path}`).send(body).expect(201)).body;

    const year = await post('/academics/years', {
      name: '2026–2027',
      startsOn: '2026-09-01',
      endsOn: '2027-07-02',
    });
    const middle = await post('/academics/divisions', { name: 'Middle' });
    const primary = await post('/academics/divisions', { name: 'Primary' });
    const grade = await post('/academics/grade-levels', {
      divisionId: middle.id,
      name: 'Grade 7',
    });
    const subject = await post('/academics/subjects', {
      code: 'SCI',
      name: 'Sciences',
    });
    const schoolClass = await post('/academics/classes', {
      academicYearId: year.id,
      code: 'SCI7A',
      name: 'Sciences 7A',
      subjectId: subject.id,
      gradeLevelId: grade.id,
    });
    const otherClass = await post('/academics/classes', {
      academicYearId: year.id,
      code: 'SCI7B',
      name: 'Sciences 7B',
    });

    const teacher = await addMember(app, school, ['teacher']);
    const otherTeacher = await addMember(app, school, ['teacher']);
    await school.admin
      .put(`/api/v1/academics/classes/${schoolClass.id}/staff`)
      .send({ staff: [{ userId: teacher.userId, role: 'teacher' }] })
      .expect(200);
    await school.admin
      .put(`/api/v1/academics/classes/${otherClass.id}/staff`)
      .send({ staff: [{ userId: otherTeacher.userId, role: 'teacher' }] })
      .expect(200);

    const studentEmail = uniqueEmail('student');
    const student = await post('/students', {
      studentNumber: `S-${uuidv7().slice(-6)}`,
      firstName: 'Amira',
      lastName: 'Haddad',
      email: studentEmail,
      gradeLevelId: grade.id,
    });
    await post(`/academics/classes/${schoolClass.id}/students`, {
      studentIds: [student.id],
    });
    const studentMember = await addMember(
      app,
      school,
      ['student'],
      studentEmail,
    );
    await deliverMail(app);

    return {
      school,
      year,
      middle,
      primary,
      grade,
      schoolClass,
      otherClass,
      teacher,
      otherTeacher,
      student,
      studentMember,
      post,
    };
  }

  describe('timetables', () => {
    it('places a Week A / Week B rotation on real dates and drops lessons on holidays', async () => {
      const {
        school,
        middle,
        primary,
        schoolClass,
        teacher,
        studentMember,
        post,
      } = await setUp();
      const schedule = await post('/timetables/bell-schedules', {
        divisionId: middle.id,
        name: 'Middle school bells',
        rotationKind: 'weekly',
        rotationLength: 2,
      });
      expect(schedule.cycleLength).toBe(10);
      const first = await post(
        `/timetables/bell-schedules/${schedule.id}/periods`,
        {
          name: 'P1',
          startsAt: '08:30',
          endsAt: '09:25',
        },
      );
      const second = await post(
        `/timetables/bell-schedules/${schedule.id}/periods`,
        {
          name: 'P2',
          startsAt: '09:30',
          endsAt: '10:25',
        },
      );
      // Week A Monday, period 1; Week B Wednesday, period 2.
      await post(`/timetables/classes/${schoolClass.id}/slots`, {
        periodId: first.id,
        cycleDay: 1,
        room: 'Lab 2',
      });
      await post(`/timetables/classes/${schoolClass.id}/slots`, {
        periodId: second.id,
        cycleDay: 8,
      });
      await school.admin
        .post(`/api/v1/timetables/classes/${schoolClass.id}/slots`)
        .send({ periodId: first.id, cycleDay: 11 })
        .expect(422);

      await post('/calendar/events', {
        title: 'Armistice',
        kind: 'holiday',
        startsOn: '2026-11-11',
        audience: 'school',
      });
      await post('/calendar/events', {
        title: 'Primary closure',
        kind: 'closure',
        startsOn: '2026-11-09',
        audience: 'division',
        audienceId: primary.id,
      });
      await post('/calendar/events', {
        title: 'Science fair',
        kind: 'closure',
        startsOn: '2026-11-25',
        audience: 'class',
        audienceId: schoolClass.id,
      });

      // 31 Aug is the first week (A); 9 Nov is ten weeks later (A), 16 Nov is B, 23 Nov is A.
      const expected = [
        { date: '2026-11-09', cycleDay: 1, period: 'P1', room: 'Lab 2' },
        { date: '2026-11-18', cycleDay: 8, period: 'P2', room: null },
        { date: '2026-11-23', cycleDay: 1, period: 'P1', room: 'Lab 2' },
      ];
      const query = '?from=2026-11-09&to=2026-11-27';
      const summarise = (
        lessons: {
          date: string;
          cycleDay: number;
          period: { name: string };
          room: string | null;
        }[],
      ) =>
        lessons.map(({ date, cycleDay, period, room }) => ({
          date,
          cycleDay,
          period: period.name,
          room,
        }));

      const { body: asStudent } = await studentMember.session
        .get(`/api/v1/timetables/me${query}`)
        .expect(200);
      expect(summarise(asStudent)).toEqual(expected);
      expect(asStudent[0]).toMatchObject({
        class: { code: 'SCI7A', subject: { code: 'SCI' } },
        teachers: [expect.any(String)],
      });

      const { body: asTeacher } = await teacher.session
        .get(`/api/v1/timetables/me${query}`)
        .expect(200);
      expect(summarise(asTeacher)).toEqual(expected);

      // The school-wide holiday on Wednesday 11 Nov (Week A) moves nothing in a weekly rotation.
      await post('/calendar/events', {
        title: 'Strike',
        kind: 'closure',
        startsOn: '2026-11-18',
        audience: 'school',
      });
      const { body: afterClosure } = await teacher.session
        .get(`/api/v1/timetables/me${query}`)
        .expect(200);
      expect(summarise(afterClosure).map((lesson) => lesson.date)).toEqual([
        '2026-11-09',
        '2026-11-23',
      ]);
    });

    it('lets families see only their own student’s timetable', async () => {
      const { school, student, otherTeacher } = await setUp();
      const parentEmail = uniqueEmail('parent');
      const { body: guardian } = await school.admin
        .post('/api/v1/guardians')
        .send({ firstName: 'Leila', lastName: 'Haddad', email: parentEmail })
        .expect(201);
      await school.admin
        .post(`/api/v1/students/${student.id}/guardians`)
        .send({ guardianId: guardian.id, relationship: 'mother' })
        .expect(201);
      const parent = await addMember(app, school, ['guardian'], parentEmail);
      await deliverMail(app);

      const range = '?from=2026-11-09&to=2026-11-13';
      await parent.session
        .get(`/api/v1/timetables/students/${student.id}${range}`)
        .expect(200);
      const { body: mine } = await parent.session
        .get('/api/v1/students/mine')
        .expect(200);
      expect(mine.map((child: { id: string }) => child.id)).toEqual([
        student.id,
      ]);
      await otherTeacher.session
        .get(`/api/v1/timetables/students/${student.id}${range}`)
        .expect(200);
      await parent.session
        .get('/api/v1/timetables/me?from=2026-11-09&to=2027-01-30')
        .expect(400);
    });
  });

  describe('calendar', () => {
    it('shows targeted events only to their audience, and repeats recurring ones', async () => {
      const {
        school,
        schoolClass,
        otherClass,
        teacher,
        otherTeacher,
        studentMember,
        post,
      } = await setUp();
      await post('/calendar/events', {
        title: 'Lab safety day',
        kind: 'event',
        startsOn: '2026-11-17',
        startTime: '13:00',
        endTime: '15:00',
        audience: 'class',
        audienceId: schoolClass.id,
      });
      await post('/calendar/events', {
        title: '7B trip',
        kind: 'event',
        startsOn: '2026-11-18',
        audience: 'class',
        audienceId: otherClass.id,
      });
      await post('/calendar/events', {
        title: 'Staff briefing',
        kind: 'event',
        startsOn: '2026-11-02',
        recurrence: 'FREQ=WEEKLY;BYDAY=MO',
        audience: 'school',
      });

      const titles = async (session: typeof teacher.session) => {
        const { body } = await session
          .get('/api/v1/calendar?from=2026-11-16&to=2026-11-29')
          .expect(200);
        return body.map(
          (item: { title: string; startsOn: string }) =>
            `${item.startsOn} ${item.title}`,
        );
      };

      expect(await titles(teacher.session)).toEqual([
        '2026-11-16 Staff briefing',
        '2026-11-17 Lab safety day',
        '2026-11-23 Staff briefing',
      ]);
      expect(await titles(studentMember.session)).toEqual(
        await titles(teacher.session),
      );
      expect(await titles(otherTeacher.session)).toEqual([
        '2026-11-16 Staff briefing',
        '2026-11-18 7B trip',
        '2026-11-23 Staff briefing',
      ]);
      expect(await titles(school.admin)).toHaveLength(4);

      await teacher.session
        .post('/api/v1/calendar/events')
        .send({
          title: 'Nope',
          kind: 'event',
          startsOn: '2026-11-20',
          audience: 'school',
        })
        .expect(403);
      const { body } = await school.admin
        .post('/api/v1/calendar/events')
        .send({
          title: 'Bad',
          kind: 'event',
          startsOn: '2026-11-20',
          recurrence: 'FREQ=HOURLY',
          audience: 'school',
        })
        .expect(400);
      expect(body.errors).toEqual([
        { field: 'recurrence', codes: ['isRecurrence'] },
      ]);
    });

    it('keeps terms inside their year and apart from each other', async () => {
      const { school, year } = await setUp();
      const terms = `/api/v1/academics/years/${year.id}/terms`;
      await school.admin
        .post(terms)
        .send({ name: 'Term 1', startsOn: '2026-09-01', endsOn: '2026-12-18' })
        .expect(201);
      await school.admin
        .post(terms)
        .send({ name: 'Term 2', startsOn: '2027-01-04', endsOn: '2027-03-26' })
        .expect(201);

      const { body: overlap } = await school.admin
        .post(terms)
        .send({ name: 'Term 3', startsOn: '2027-03-20', endsOn: '2027-07-02' })
        .expect(409);
      expect(overlap.code).toBe('terms_overlap');
      const { body: outside } = await school.admin
        .post(terms)
        .send({ name: 'Term 3', startsOn: '2027-04-12', endsOn: '2027-07-30' })
        .expect(400);
      expect(outside.errors).toEqual([
        { field: 'endsOn', codes: ['withinYear'] },
      ]);

      const { body: list } = await school.admin.get(terms).expect(200);
      expect(list.map((term: { name: string }) => term.name)).toEqual([
        'Term 1',
        'Term 2',
      ]);
    });
  });

  it.each([
    [
      'calendar_events',
      `INSERT INTO calendar_events (id, title, kind, starts_on, ends_on, audience) VALUES ($1, 'Probe', 'event', '2026-11-20', '2026-11-20', 'school')`,
    ],
    [
      'bell_schedules',
      `INSERT INTO bell_schedules (id, name, rotation_kind, rotation_length) VALUES ($1, 'Probe', 'weekly', 1)`,
    ],
  ])('isolates %s between schools', async (table, sql) => {
    const txHost =
      app.get<TransactionHost<TransactionalAdapterTypeOrm>>(TransactionHost);
    await expectTenantIsolation(app, {
      table,
      insertRow: async () => {
        const id = uuidv7();
        await txHost.tx.query(sql, [id]);
        return id;
      },
    });
  });
});
