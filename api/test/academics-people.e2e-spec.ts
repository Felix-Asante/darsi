import type { INestApplication } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { v7 as uuidv7 } from 'uuid';
import { createTestApp } from './support/create-test-app.js';
import {
  addMember,
  createSchool,
  type CreatedSchool,
  deliverMail,
  uniqueEmail,
} from './support/identity.js';
import { expectTenantIsolation } from './support/tenant-isolation.js';

describe('Academic structure and people (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  /** A school with a current year, one division and grade level, and a subject. */
  async function setUpSchool() {
    const school = await createSchool(app);
    const { body: year } = await school.admin
      .post('/api/v1/academics/years')
      .send({ name: '2026–2027', startsOn: '2026-09-01', endsOn: '2027-07-02' })
      .expect(201);
    const { body: division } = await school.admin
      .post('/api/v1/academics/divisions')
      .send({ name: 'Middle School' })
      .expect(201);
    const { body: grade } = await school.admin
      .post('/api/v1/academics/grade-levels')
      .send({ divisionId: division.id, name: 'Grade 7' })
      .expect(201);
    const { body: subject } = await school.admin
      .post('/api/v1/academics/subjects')
      .send({ code: 'SCI', name: 'Sciences' })
      .expect(201);
    return { school, year, division, grade, subject };
  }

  async function createStudent(
    school: CreatedSchool,
    overrides: Record<string, unknown> = {},
  ) {
    const { body } = await school.admin
      .post('/api/v1/students')
      .send({
        studentNumber: `S-${uuidv7().slice(-6)}`,
        firstName: 'Amira',
        lastName: 'Haddad',
        ...overrides,
      })
      .expect(201);
    return body;
  }

  describe('academic structure', () => {
    it('makes the first year current and keeps exactly one current year', async () => {
      const { school, year } = await setUpSchool();
      expect(year.isCurrent).toBe(true);

      const { body: next } = await school.admin
        .post('/api/v1/academics/years')
        .send({
          name: '2027–2028',
          startsOn: '2027-09-01',
          endsOn: '2028-07-01',
          isCurrent: true,
        })
        .expect(201);
      const { body: years } = await school.admin
        .get('/api/v1/academics/years')
        .expect(200);

      expect(
        years.filter(
          (candidate: { isCurrent: boolean }) => candidate.isCurrent,
        ),
      ).toEqual([expect.objectContaining({ id: next.id })]);
    });

    it('rejects a year that ends before it starts and an impossible date', async () => {
      const school = await createSchool(app);
      const { body } = await school.admin
        .post('/api/v1/academics/years')
        .send({ name: 'Bad', startsOn: '2027-07-01', endsOn: '2027-02-30' })
        .expect(400);

      expect(body.errors).toEqual([
        { field: 'endsOn', codes: ['isCalendarDate'] },
      ]);
    });

    it('nests grade levels under divisions and refuses a duplicate subject code', async () => {
      const { school, division, grade } = await setUpSchool();

      const { body: divisions } = await school.admin
        .get('/api/v1/academics/divisions')
        .expect(200);
      expect(divisions).toEqual([
        expect.objectContaining({
          id: division.id,
          gradeLevels: [
            expect.objectContaining({ id: grade.id, name: 'Grade 7' }),
          ],
        }),
      ]);

      const { body } = await school.admin
        .post('/api/v1/academics/subjects')
        .send({ code: 'SCI', name: 'Science' })
        .expect(409);
      expect(body).toMatchObject({
        code: 'already_exists',
        errors: [{ field: 'code', codes: ['alreadyExists'] }],
      });
    });

    it('shows teachers only the classes they work in', async () => {
      const { school, year, grade, subject } = await setUpSchool();
      const teacher = await addMember(app, school, ['teacher']);
      const otherTeacher = await addMember(app, school, ['teacher']);
      const { body: science } = await school.admin
        .post('/api/v1/academics/classes')
        .send({
          academicYearId: year.id,
          gradeLevelId: grade.id,
          subjectId: subject.id,
          code: '7SCI-A',
          name: 'Grade 7 Sciences A',
        })
        .expect(201);
      await school.admin
        .post('/api/v1/academics/classes')
        .send({
          academicYearId: year.id,
          code: '7SCI-B',
          name: 'Grade 7 Sciences B',
        })
        .expect(201);

      const { body: withStaff } = await school.admin
        .put(`/api/v1/academics/classes/${science.id}/staff`)
        .send({ staff: [{ userId: teacher.userId, role: 'teacher' }] })
        .expect(200);
      expect(withStaff.staff).toEqual([
        expect.objectContaining({ userId: teacher.userId, role: 'teacher' }),
      ]);

      const { body: mine } = await teacher.session
        .get('/api/v1/academics/classes')
        .expect(200);
      expect(
        mine.map((schoolClass: { code: string }) => schoolClass.code),
      ).toEqual(['7SCI-A']);
      await otherTeacher.session
        .get(`/api/v1/academics/classes/${science.id}`)
        .expect(403);

      const { body: all } = await school.admin
        .get('/api/v1/academics/classes')
        .expect(200);
      expect(all).toHaveLength(2);
    });

    it('only assigns staff who belong to the school', async () => {
      const { school, year } = await setUpSchool();
      const outsider = await createSchool(app);
      const { body: outsiderMe } = await outsider.admin
        .get('/api/v1/me')
        .expect(200);
      const { body: schoolClass } = await school.admin
        .post('/api/v1/academics/classes')
        .send({ academicYearId: year.id, code: 'ART', name: 'Art' })
        .expect(201);

      const { body } = await school.admin
        .put(`/api/v1/academics/classes/${schoolClass.id}/staff`)
        .send({ staff: [{ userId: outsiderMe.user.id, role: 'teacher' }] })
        .expect(422);
      expect(body.code).toBe('not_a_member');
    });
  });

  describe('students, guardians and families', () => {
    it('refuses a student number already in use', async () => {
      const { school } = await setUpSchool();
      await createStudent(school, { studentNumber: 'S-0001' });

      const { body } = await school.admin
        .post('/api/v1/students')
        .send({ studentNumber: 'S-0001', firstName: 'Copy', lastName: 'Cat' })
        .expect(409);
      expect(body.errors).toEqual([
        { field: 'studentNumber', codes: ['alreadyExists'] },
      ]);
    });

    it('finds students by name or number', async () => {
      const { school } = await setUpSchool();
      await createStudent(school, {
        firstName: 'Lucas',
        lastName: 'Moreau',
        studentNumber: 'LM-1',
      });
      await createStudent(school, {
        firstName: 'Noah',
        lastName: 'Okafor',
        studentNumber: 'NO-1',
      });

      const byName = await school.admin
        .get('/api/v1/students?search=moreau')
        .expect(200);
      const byFullName = await school.admin
        .get('/api/v1/students?search=noah%20oka')
        .expect(200);
      const byNumber = await school.admin
        .get('/api/v1/students?search=NO-1')
        .expect(200);

      expect(
        byName.body.items.map(
          (student: { firstName: string }) => student.firstName,
        ),
      ).toEqual(['Lucas']);
      expect(
        byFullName.body.items.map(
          (student: { firstName: string }) => student.firstName,
        ),
      ).toEqual(['Noah']);
      expect(byNumber.body.items).toHaveLength(1);
    });

    it('groups a guardian and siblings into one family', async () => {
      const { school, grade } = await setUpSchool();
      const amira = await createStudent(school, { gradeLevelId: grade.id });
      const younger = await createStudent(school, { firstName: 'Yasmine' });
      const { body: mother } = await school.admin
        .post('/api/v1/guardians')
        .send({
          firstName: 'Leila',
          lastName: 'Haddad',
          email: uniqueEmail('leila'),
          preferredLocale: 'fr',
        })
        .expect(201);

      await school.admin
        .post(`/api/v1/students/${amira.id}/guardians`)
        .send({
          guardianId: mother.id,
          relationship: 'mother',
          isPrimaryContact: true,
        })
        .expect(201);
      const { body: profile } = await school.admin
        .post(`/api/v1/students/${younger.id}/guardians`)
        .send({ guardianId: mother.id, relationship: 'mother' })
        .expect(201);

      expect(profile.family.name).toBe('Haddad family');
      expect(profile.siblings).toEqual([
        expect.objectContaining({
          id: amira.id,
          gradeLevel: { id: grade.id, name: 'Grade 7' },
        }),
      ]);
      expect(profile.guardians).toEqual([
        expect.objectContaining({
          id: mother.id,
          relationship: 'mother',
          hasAccount: false,
        }),
      ]);
    });

    it('links a guardian’s record to their account when they join, and shows them only their child', async () => {
      const { school } = await setUpSchool();
      const child = await createStudent(school);
      const stranger = await createStudent(school, { firstName: 'Other' });
      const email = uniqueEmail('parent');
      const { body: guardian } = await school.admin
        .post('/api/v1/guardians')
        .send({ firstName: 'Sam', lastName: 'Haddad', email })
        .expect(201);
      await school.admin
        .post(`/api/v1/students/${child.id}/guardians`)
        .send({ guardianId: guardian.id, relationship: 'parent' })
        .expect(201);

      const parent = await addMember(app, school, ['guardian'], email);
      await deliverMail(app);

      const { body: linked } = await school.admin
        .get(`/api/v1/guardians/${guardian.id}`)
        .expect(200);
      expect(linked.hasAccount).toBe(true);
      await parent.session.get(`/api/v1/students/${child.id}`).expect(200);
      await parent.session.get(`/api/v1/students/${stranger.id}`).expect(403);
      await parent.session.get('/api/v1/students').expect(403);
    });

    it('enrols students in a class and keeps the history when they leave', async () => {
      const { school, year } = await setUpSchool();
      const teacher = await addMember(app, school, ['teacher']);
      const { body: schoolClass } = await school.admin
        .post('/api/v1/academics/classes')
        .send({
          academicYearId: year.id,
          code: 'MATH-7',
          name: 'Mathematics 7',
        })
        .expect(201);
      await school.admin
        .put(`/api/v1/academics/classes/${schoolClass.id}/staff`)
        .send({ staff: [{ userId: teacher.userId, role: 'teacher' }] })
        .expect(200);
      const a = await createStudent(school, { lastName: 'Abbas' });
      const b = await createStudent(school, { lastName: 'Bennani' });

      const { body: roster } = await school.admin
        .post(`/api/v1/academics/classes/${schoolClass.id}/students`)
        .send({ studentIds: [b.id, a.id, a.id], startsOn: '2026-09-01' })
        .expect(201);
      expect(
        roster.map((student: { lastName: string }) => student.lastName),
      ).toEqual(['Abbas', 'Bennani']);

      await teacher.session
        .get(`/api/v1/academics/classes/${schoolClass.id}/students`)
        .expect(200);
      await school.admin
        .delete(`/api/v1/academics/classes/${schoolClass.id}/students/${a.id}`)
        .expect(204);
      const { body: after } = await teacher.session
        .get(`/api/v1/academics/classes/${schoolClass.id}/students`)
        .expect(200);
      expect(after.map((student: { id: string }) => student.id)).toEqual([
        b.id,
      ]);

      const { body: profile } = await school.admin
        .get(`/api/v1/students/${b.id}`)
        .expect(200);
      expect(profile.classes).toEqual([
        expect.objectContaining({
          code: 'MATH-7',
          enrolledSince: '2026-09-01',
        }),
      ]);
    });

    it('isolates students per school', async () => {
      const txHost =
        app.get<TransactionHost<TransactionalAdapterTypeOrm>>(TransactionHost);
      await expectTenantIsolation(app, {
        table: 'students',
        insertRow: async () => {
          const id = uuidv7();
          await txHost.tx.query(
            `INSERT INTO students (id, student_number, first_name, last_name) VALUES ($1, $2, 'Probe', 'Row')`,
            [id, `P-${id.slice(-6)}`],
          );
          return id;
        },
      });
    });
  });

  describe('curriculum', () => {
    it('keeps standards as a tree under their framework', async () => {
      const { school } = await setUpSchool();
      const { body: framework } = await school.admin
        .post('/api/v1/curriculum/frameworks')
        .send({ code: 'MYP-SCI', name: 'IB MYP Sciences' })
        .expect(201);
      const { body: criterion } = await school.admin
        .post(`/api/v1/curriculum/frameworks/${framework.id}/standards`)
        .send({ code: 'A', description: 'Knowing and understanding' })
        .expect(201);
      await school.admin
        .post(`/api/v1/curriculum/frameworks/${framework.id}/standards`)
        .send({
          code: 'A.i',
          description: 'Explain scientific knowledge',
          parentId: criterion.id,
        })
        .expect(201);

      const { body: tree } = await school.admin
        .get(`/api/v1/curriculum/frameworks/${framework.id}/standards`)
        .expect(200);
      expect(tree).toEqual([
        expect.objectContaining({
          code: 'A',
          children: [expect.objectContaining({ code: 'A.i', children: [] })],
        }),
      ]);
    });
  });
});
