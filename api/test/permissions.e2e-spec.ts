import type { INestApplication } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { createTestApp } from './support/create-test-app.js';
import { type Agent, addMember, createSchool } from './support/identity.js';

type Role =
  | 'admin'
  | 'coordinator'
  | 'teacher'
  | 'teaching_assistant'
  | 'student'
  | 'guardian'
  | 'finance_officer'
  | 'admissions_officer';
const ROLES: Role[] = [
  'admin',
  'coordinator',
  'teacher',
  'teaching_assistant',
  'student',
  'guardian',
  'finance_officer',
  'admissions_officer',
];

/**
 * The PRD permissions matrix (section 5), checked through the HTTP API for
 * every role. "Allowed" means the guard let the request through; it may still
 * fail validation, which is fine here.
 */
describe('Permissions matrix (e2e)', () => {
  let app: INestApplication;
  let sessions: Record<Role, Agent>;
  let ids: { classId: string; studentId: string; termId: string };

  beforeAll(async () => {
    app = await createTestApp();
    const school = await createSchool(app);
    const post = async (path: string, body: object) =>
      (await school.admin.post(`/api/v1${path}`).send(body).expect(201)).body;
    const year = await post('/academics/years', {
      name: 'Year',
      startsOn: '2026-09-01',
      endsOn: '2027-07-02',
    });
    const term = await post(`/academics/years/${year.id}/terms`, {
      name: 'Term 1',
      startsOn: '2026-09-01',
      endsOn: '2026-12-18',
    });
    const schoolClass = await post('/academics/classes', {
      academicYearId: year.id,
      code: '7A',
      name: 'Class 7A',
    });
    const student = await post('/students', {
      studentNumber: `S-${uuidv7().slice(-6)}`,
      firstName: 'A',
      lastName: 'B',
    });
    ids = { classId: schoolClass.id, studentId: student.id, termId: term.id };
    sessions = { admin: school.admin } as Record<Role, Agent>;
    for (const role of ROLES.filter((candidate) => candidate !== 'admin')) {
      sessions[role] = (await addMember(app, school, [role])).session;
    }
    const teacher = await school.admin.get('/api/v1/me').expect(200);
    expect(teacher.body).toBeTruthy();
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  const cases: {
    name: string;
    allowed: Role[];
    send: (agent: Agent) => ReturnType<Agent['get']>;
  }[] = [
    {
      name: 'read the student directory',
      allowed: [
        'admin',
        'coordinator',
        'teacher',
        'teaching_assistant',
        'finance_officer',
        'admissions_officer',
      ],
      send: (a) => a.get('/api/v1/students'),
    },
    {
      name: 'add a student',
      allowed: ['admin'],
      send: (a) => a.post('/api/v1/students').send({}),
    },
    {
      name: 'create a class',
      allowed: ['admin'],
      send: (a) => a.post('/api/v1/academics/classes').send({}),
    },
    {
      name: 'change grading policies',
      allowed: ['admin'],
      send: (a) => a.put('/api/v1/grading/policies').send({}),
    },
    {
      name: 'create an assessment',
      allowed: ['teacher'],
      send: (a) =>
        a
          .post(`/api/v1/assessment/classes/${ids.classId}/assessments`)
          .send({}),
    },
    {
      name: 'add a calendar event',
      allowed: ['admin', 'coordinator'],
      send: (a) => a.post('/api/v1/calendar/events').send({}),
    },
    {
      name: 'change attendance settings',
      allowed: ['admin'],
      send: (a) => a.put('/api/v1/attendance/settings').send({}),
    },
    {
      name: 'read the attendance report',
      allowed: ['admin', 'coordinator'],
      send: (a) =>
        a.get('/api/v1/attendance/report?from=2026-09-01&to=2026-09-30'),
    },
    {
      name: 'post to the whole school',
      allowed: [
        'admin',
        'coordinator',
        'finance_officer',
        'admissions_officer',
      ],
      send: (a) =>
        a
          .post('/api/v1/announcements')
          .send({ title: 'x', body: { type: 'doc' }, audience: 'school' }),
    },
    {
      name: 'open term reports',
      allowed: ['admin'],
      send: (a) => a.post(`/api/v1/reports/terms/${ids.termId}/open`).send({}),
    },
    {
      name: 'see storage use',
      allowed: ['admin'],
      send: (a) => a.get('/api/v1/files/usage'),
    },
    {
      name: "export a student's data",
      allowed: ['admin'],
      send: (a) => a.get(`/api/v1/privacy/students/${ids.studentId}/export`),
    },
    {
      name: 'change school settings',
      allowed: ['admin'],
      send: (a) => a.patch('/api/v1/schools/current').send({}),
    },
  ];

  it.each(cases)(
    'only the right roles can $name',
    async ({ allowed, send }) => {
      for (const role of ROLES) {
        const { status } = await send(sessions[role]);
        expect({ role, forbidden: status === 403 }).toEqual({
          role,
          forbidden: !allowed.includes(role),
        });
      }
    },
  );

  it('refuses changes that do not come from the app', async () => {
    const { status, body } = await sessions.admin
      .post('/api/v1/students')
      .set('Origin', 'https://evil.example')
      .send({});
    expect(status).toBe(403);
    expect(body.code).toBe('untrusted_origin');
  });
});
