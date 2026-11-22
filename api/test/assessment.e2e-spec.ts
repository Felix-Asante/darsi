import type { INestApplication } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { v7 as uuidv7 } from 'uuid';
import { TenantTransactions } from '../src/common/tenancy/tenant-transactions.js';
import { AuditEvent } from '../src/modules/audit/audit-event.entity.js';
import { createTestApp } from './support/create-test-app.js';
import {
  addMember,
  createSchool,
  deliverMail,
  uniqueEmail,
} from './support/identity.js';
import { expectTenantIsolation } from './support/tenant-isolation.js';

const even = (codes: string[]) =>
  codes.map((code, index) => ({
    code,
    minMastery: Math.round((index / codes.length) * 10_000) / 10_000,
  }));

/** Six real schemes, entered as an admin would in the scale editor (ASM-1). */
const SCHEMES = {
  myp: {
    name: 'IB MYP criterion',
    definition: {
      kind: 'levels',
      levels: even(['0', '1', '2', '3', '4', '5', '6', '7', '8']),
    },
  },
  dp: {
    name: 'IB DP',
    definition: {
      kind: 'levels',
      levels: even(['1', '2', '3', '4', '5', '6', '7']),
    },
  },
  us: {
    name: 'US letters',
    definition: {
      kind: 'letter',
      levels: [
        ['F', 0],
        ['D-', 0.6],
        ['D', 0.63],
        ['D+', 0.67],
        ['C-', 0.7],
        ['C', 0.73],
        ['C+', 0.77],
        ['B-', 0.8],
        ['B', 0.83],
        ['B+', 0.87],
        ['A-', 0.9],
        ['A', 0.93],
        ['A+', 0.97],
      ].map(([code, minMastery]) => ({ code, minMastery })),
    },
  },
  fr: {
    name: 'Note sur 20',
    definition: { kind: 'points', maxPoints: 20, decimals: 1 },
  },
  gcse: {
    name: 'GCSE',
    definition: {
      kind: 'levels',
      levels: even(['U', '1', '2', '3', '4', '5', '6', '7', '8', '9']),
    },
  },
  sbg: {
    name: 'Standards 1–4',
    definition: {
      kind: 'standards',
      levels: [
        { code: '1', label: 'Beginning', minMastery: 0 },
        { code: '2', label: 'Developing', minMastery: 0.4 },
        { code: '3', label: 'Proficient', minMastery: 0.65 },
        { code: '4', label: 'Exceeding', minMastery: 0.85 },
      ],
    },
  },
} as const;

describe('Assessment and grading (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function setUp() {
    const school = await createSchool(app);
    const post = async (path: string, body: object, agent = school.admin) =>
      (await agent.post(`/api/v1${path}`).send(body).expect(201)).body;

    const scales: Record<keyof typeof SCHEMES, { id: string }> = {} as never;
    for (const [key, scheme] of Object.entries(SCHEMES)) {
      scales[key as keyof typeof SCHEMES] = await post(
        '/grading/scales',
        scheme,
      );
    }
    const year = await post('/academics/years', {
      name: '2026–2027',
      startsOn: '2026-09-01',
      endsOn: '2027-07-02',
    });
    const term1 = await post(`/academics/years/${year.id}/terms`, {
      name: 'Term 1',
      startsOn: '2026-09-01',
      endsOn: '2026-12-18',
    });
    const subject = await post('/academics/subjects', {
      code: 'MATH',
      name: 'Mathematics',
    });
    await school.admin
      .put('/api/v1/grading/policies')
      .send({
        subjectId: subject.id,
        reportingScaleId: scales.us.id,
        method: 'weighted_average',
        categories: [
          { name: 'Homework', weight: 30 },
          { name: 'Exams', weight: 70 },
        ],
      })
      .expect(200);
    const { body: policies } = await school.admin
      .get('/api/v1/grading/policies')
      .expect(200);
    const categories = Object.fromEntries(
      policies[0].categories.map((category: { name: string; id: string }) => [
        category.name,
        category.id,
      ]),
    ) as Record<'Homework' | 'Exams', string>;

    const schoolClass = await post('/academics/classes', {
      academicYearId: year.id,
      code: 'M7A',
      name: 'Mathematics 7A',
      subjectId: subject.id,
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
    const parentEmail = uniqueEmail('parent');
    const student = await post('/students', {
      studentNumber: `S-${uuidv7().slice(-6)}`,
      firstName: 'Amira',
      lastName: 'Haddad',
      email: studentEmail,
    });
    const other = await post('/students', {
      studentNumber: `S-${uuidv7().slice(-6)}`,
      firstName: 'Lucas',
      lastName: 'Martin',
    });
    const guardian = await post('/guardians', {
      firstName: 'Leila',
      lastName: 'Haddad',
      email: parentEmail,
    });
    await post(`/students/${student.id}/guardians`, {
      guardianId: guardian.id,
      relationship: 'mother',
    });
    await post(`/academics/classes/${schoolClass.id}/students`, {
      studentIds: [student.id, other.id],
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
      scales,
      term1,
      categories,
      schoolClass,
      teacher,
      assistant,
      student,
      other,
      studentMember,
      parent,
      post,
    };
  }

  it('encodes six real grading schemes and shows a grade on any other through the school’s conversions (ASM-1/2/3)', async () => {
    const { school, scales } = await setUp();
    const convert = async (
      from: keyof typeof SCHEMES,
      to: keyof typeof SCHEMES,
      value: string,
    ) =>
      (
        await school.admin
          .post('/api/v1/grading/convert')
          .send({
            fromScaleId: scales[from].id,
            toScaleId: scales[to].id,
            value,
          })
          .expect(200)
      ).body.value;

    expect(await convert('fr', 'us', '15')).toBe('C');
    expect(await convert('dp', 'fr', '7')).toBe(18.6);
    expect(await convert('myp', 'dp', '8')).toBe('7');
    expect(await convert('gcse', 'sbg', '9')).toBe('4');
    expect(await convert('sbg', 'myp', '2')).toBe('4');
    expect(await convert('us', 'gcse', 'b+')).toBe('8');

    // French 15/20 is "très bien": the school's own table says A, not the linear C.
    await school.admin
      .put('/api/v1/grading/conversions')
      .send({
        fromScaleId: scales.fr.id,
        toScaleId: scales.us.id,
        mapping: { '15': 'A', '16': 'a+' },
      })
      .expect(200);
    expect(await convert('fr', 'us', '15')).toBe('A');
    expect(await convert('fr', 'us', '16')).toBe('A+');
    expect(await convert('fr', 'us', '14')).toBe('C-');

    const { body: invalid } = await school.admin
      .post('/api/v1/grading/scales')
      .send({
        name: 'Broken',
        definition: {
          kind: 'letter',
          levels: [
            { code: 'A', minMastery: 0.2 },
            { code: 'B', minMastery: 0.1 },
          ],
        },
      })
      .expect(400);
    expect(invalid).toMatchObject({
      code: 'invalid_scale',
      errors: [
        {
          field: 'definition',
          codes: ['firstLevelStartsAtZero', 'levelsAscending'],
        },
      ],
    });
  });

  it('runs the grading workflow: assistant drafts, teacher publishes, families see and are told, changes are audited', async () => {
    const {
      school,
      scales,
      categories,
      schoolClass,
      teacher,
      assistant,
      student,
      other,
      studentMember,
      parent,
    } = await setUp();
    const { body: exam } = await teacher.session
      .post(`/api/v1/assessment/classes/${schoolClass.id}/assessments`)
      .send({
        title: 'Fractions test',
        kind: 'summative',
        dueOn: '2026-10-15',
        scaleId: scales.fr.id,
        categoryId: categories.Exams,
      })
      .expect(201);
    await assistant.session
      .post(`/api/v1/assessment/classes/${schoolClass.id}/assessments`)
      .send({ title: 'Nope', kind: 'formative', scaleId: scales.fr.id })
      .expect(403);

    // The assistant enters drafts; publishing is the teacher's.
    await assistant.session
      .put(`/api/v1/assessment/assessments/${exam.id}/grades`)
      .send({
        grades: [
          { studentId: student.id, value: '15,5', comment: 'Bon travail' },
          { studentId: other.id, value: '9' },
        ],
      })
      .expect(200);
    await assistant.session
      .put(`/api/v1/assessment/assessments/${exam.id}/grades`)
      .send({
        grades: [{ studentId: student.id, value: '15.5' }],
        publish: true,
      })
      .expect(403);
    const { body: invalid } = await teacher.session
      .put(`/api/v1/assessment/assessments/${exam.id}/grades`)
      .send({ grades: [{ studentId: student.id, value: '25' }] })
      .expect(422);
    expect(invalid.errors).toEqual([
      { field: 'grades.0.value', codes: ['outOfRange'] },
    ]);

    const before = await studentMember.session
      .get(`/api/v1/assessment/students/${student.id}/grades`)
      .expect(200);
    expect(before.body[0].assessments[0].grade).toBeNull();

    const { body: sheet } = await teacher.session
      .post(`/api/v1/assessment/assessments/${exam.id}/publish`)
      .expect(200);
    expect(
      sheet.grades.map((grade: { status: string }) => grade.status),
    ).toEqual(['published', 'published']);

    const { body: mine } = await parent.session
      .get(`/api/v1/assessment/students/${student.id}/grades`)
      .expect(200);
    expect(mine[0]).toMatchObject({
      class: { code: 'M7A' },
      reportingScale: { name: 'US letters' },
      assessments: [
        {
          title: 'Fractions test',
          grade: { value: '15.5', reported: 'C+', comment: 'Bon travail' },
        },
      ],
    });
    const { body: inbox } = await parent.session
      .get('/api/v1/notifications')
      .expect(200);
    expect(inbox.items[0]).toMatchObject({
      type: 'grade.published',
      params: { assessment: 'Fractions test' },
    });

    // A conversion table saved now does not change the grade already published (ASM-3).
    await school.admin
      .put('/api/v1/grading/conversions')
      .send({
        fromScaleId: scales.fr.id,
        toScaleId: scales.us.id,
        mapping: { '15.5': 'A' },
      })
      .expect(200);
    const { body: after } = await studentMember.session
      .get(`/api/v1/assessment/students/${student.id}/grades`)
      .expect(200);
    expect(after[0].assessments[0].grade.reported).toBe('C+');

    // Changing a published grade: only the teacher, and it is audited with old and new values (ASM-13).
    await assistant.session
      .put(`/api/v1/assessment/assessments/${exam.id}/grades`)
      .send({ grades: [{ studentId: student.id, value: '17' }] })
      .expect(403);
    await teacher.session
      .put(`/api/v1/assessment/assessments/${exam.id}/grades`)
      .send({
        grades: [
          { studentId: student.id, value: '17', comment: 'Bon travail' },
        ],
      })
      .expect(200);
    const txHost =
      app.get<TransactionHost<TransactionalAdapterTypeOrm>>(TransactionHost);
    const changes = await app
      .get(TenantTransactions)
      .runInSchool(school.id, () =>
        txHost.tx.find(AuditEvent, { where: { action: 'grade.changed' } }),
      );
    expect(changes).toEqual([
      expect.objectContaining({
        diff: { value: { before: '15.5', after: '17' } },
      }),
    ]);

    await studentMember.session
      .get(`/api/v1/assessment/students/${other.id}/grades`)
      .expect(403);
    await studentMember.session
      .get(`/api/v1/assessment/assessments/${exam.id}/grades`)
      .expect(403);
  });

  it('computes term results from weighted categories, leaving out formative, excused and other-term work (ASM-8/9/11)', async () => {
    const { scales, categories, schoolClass, teacher, student, other, term1 } =
      await setUp();
    const create = async (body: object) =>
      (
        await teacher.session
          .post(`/api/v1/assessment/classes/${schoolClass.id}/assessments`)
          .send(body)
          .expect(201)
      ).body;
    const grade = async (assessmentId: string, grades: object[]) =>
      teacher.session
        .put(`/api/v1/assessment/assessments/${assessmentId}/grades`)
        .send({ grades, publish: true })
        .expect(200);

    const homework = await create({
      title: 'Homework 1',
      kind: 'summative',
      dueOn: '2026-10-01',
      scaleId: scales.fr.id,
      categoryId: categories.Homework,
    });
    const exam = await create({
      title: 'Exam',
      kind: 'summative',
      dueOn: '2026-12-10',
      scaleId: scales.fr.id,
      categoryId: categories.Exams,
    });
    const quiz = await create({
      title: 'Quiz',
      kind: 'formative',
      dueOn: '2026-11-05',
      scaleId: scales.fr.id,
      categoryId: categories.Exams,
    });
    const january = await create({
      title: 'January test',
      kind: 'summative',
      dueOn: '2027-01-20',
      scaleId: scales.fr.id,
      categoryId: categories.Exams,
    });

    await grade(homework.id, [
      { studentId: student.id, value: '12' },
      { studentId: other.id, excused: true },
    ]);
    await grade(exam.id, [
      { studentId: student.id, value: '18' },
      { studentId: other.id, value: '10' },
    ]);
    await grade(quiz.id, [{ studentId: student.id, value: '2' }]);
    await grade(january.id, [{ studentId: student.id, value: '0' }]);

    const { body: book } = await teacher.session
      .get(
        `/api/v1/assessment/classes/${schoolClass.id}/gradebook?termId=${term1.id}`,
      )
      .expect(200);
    expect(
      book.assessments.map((assessment: { title: string }) => assessment.title),
    ).toEqual(['Homework 1', 'Quiz', 'Exam']);
    // Amira: homework 0.6 × 30 + exam 0.9 × 70 → 0.81 → B-. Lucas: excused homework, exam 0.5 → F.
    const result = (studentId: string) =>
      book.results.find(
        (entry: { studentId: string }) => entry.studentId === studentId,
      );
    expect(result(student.id).mastery).toBeCloseTo(0.81);
    expect(result(student.id).value).toBe('B-');
    expect(result(other.id)).toMatchObject({ mastery: 0.5, value: 'F' });
  });

  it('grades a rubric from its criteria, each on its own scale (ASM-5)', async () => {
    const { scales, schoolClass, teacher, student } = await setUp();
    const { body: project } = await teacher.session
      .post(`/api/v1/assessment/classes/${schoolClass.id}/assessments`)
      .send({
        title: 'Investigation',
        kind: 'summative',
        scaleId: scales.dp.id,
        criteria: [
          { name: 'A: Knowing', scaleId: scales.myp.id, weight: 1 },
          { name: 'B: Investigating', scaleId: scales.sbg.id, weight: 1 },
        ],
      })
      .expect(201);
    const [knowing, investigating] = project.criteria;

    const { body: sheet } = await teacher.session
      .put(`/api/v1/assessment/assessments/${project.id}/grades`)
      .send({
        grades: [
          {
            studentId: student.id,
            criterionValues: { [knowing.id]: '8', [investigating.id]: '4' },
          },
        ],
      })
      .expect(200);
    expect(sheet.grades[0]).toMatchObject({
      value: '7',
      criterionValues: { [knowing.id]: '8', [investigating.id]: '4' },
    });

    const { body: bad } = await teacher.session
      .put(`/api/v1/assessment/assessments/${project.id}/grades`)
      .send({
        grades: [
          { studentId: student.id, criterionValues: { [knowing.id]: '9' } },
        ],
      })
      .expect(422);
    expect(bad.errors).toEqual([
      {
        field: `grades.0.criterionValues.${knowing.id}`,
        codes: ['unknownLevel'],
      },
    ]);
  });

  it('keeps a scale version for the grades given with it', async () => {
    const { school, scales, schoolClass, teacher, student } = await setUp();
    const { body: oldTest } = await teacher.session
      .post(`/api/v1/assessment/classes/${schoolClass.id}/assessments`)
      .send({ title: 'Old', kind: 'summative', scaleId: scales.fr.id })
      .expect(201);
    const { body: updated } = await school.admin
      .put(`/api/v1/grading/scales/${scales.fr.id}`)
      .send({
        name: 'Note sur 10',
        definition: { kind: 'points', maxPoints: 10, decimals: 1 },
      })
      .expect(200);
    expect(updated.version).toBe(2);

    await teacher.session
      .put(`/api/v1/assessment/assessments/${oldTest.id}/grades`)
      .send({ grades: [{ studentId: student.id, value: '18' }] })
      .expect(200);
    const txHost =
      app.get<TransactionHost<TransactionalAdapterTypeOrm>>(TransactionHost);
    await expect(
      app
        .get(TenantTransactions)
        .runInSchool(school.id, () =>
          txHost.tx.query(
            `UPDATE grading_scale_versions SET definition = '{}' WHERE scale_id = $1`,
            [scales.fr.id],
          ),
        ),
    ).rejects.toThrow(/immutable/);
  });

  it('takes text submissions, flags late ones, and puts due dates on the calendar (ASM-10, CAL-6)', async () => {
    const { scales, schoolClass, teacher, student, studentMember, parent } =
      await setUp();
    const { body: essay } = await teacher.session
      .post(`/api/v1/assessment/classes/${schoolClass.id}/assessments`)
      .send({
        title: 'Essay',
        kind: 'formative',
        dueOn: '2026-09-15',
        scaleId: scales.sbg.id,
      })
      .expect(201);
    const { body: submission } = await studentMember.session
      .put(`/api/v1/assessment/assessments/${essay.id}/submission`)
      .send({ body: 'My essay' })
      .expect(200);
    expect(submission.isLate).toBe(true);
    await parent.session
      .put(`/api/v1/assessment/assessments/${essay.id}/submission`)
      .send({ body: 'Not mine' })
      .expect(403);

    const { body: sheet } = await teacher.session
      .get(`/api/v1/assessment/assessments/${essay.id}/grades`)
      .expect(200);
    expect(sheet.submissions).toEqual([
      expect.objectContaining({
        studentId: student.id,
        body: 'My essay',
        isLate: true,
      }),
    ]);

    const { body: calendar } = await studentMember.session
      .get('/api/v1/calendar?from=2026-09-14&to=2026-09-16')
      .expect(200);
    expect(calendar).toEqual([
      expect.objectContaining({
        source: 'assessment',
        title: 'Essay · Mathematics 7A',
        startsOn: '2026-09-15',
        link: '/grades',
      }),
    ]);
  });

  it('loads a 40 × 30 gradebook in under 1.5 seconds (ASM-8)', async () => {
    const { scales, schoolClass, teacher, student, other, post } =
      await setUp();
    const created: { id: string }[] = [student, other];
    for (let index = 0; index < 38; index += 1) {
      created.push(
        await post('/students', {
          studentNumber: `P-${uuidv7().slice(-8)}`,
          firstName: 'Student',
          lastName: `Number ${index}`,
        }),
      );
    }
    await post(`/academics/classes/${schoolClass.id}/students`, {
      studentIds: created.slice(2).map((entry) => entry.id),
    });
    for (let index = 0; index < 30; index += 1) {
      const { body: assessment } = await teacher.session
        .post(`/api/v1/assessment/classes/${schoolClass.id}/assessments`)
        .send({
          title: `Test ${index}`,
          kind: 'summative',
          dueOn: '2026-10-01',
          scaleId: scales.fr.id,
        })
        .expect(201);
      await teacher.session
        .put(`/api/v1/assessment/assessments/${assessment.id}/grades`)
        .send({
          grades: created.map((entry, n) => ({
            studentId: entry.id,
            value: String(n % 21),
          })),
          publish: true,
        })
        .expect(200);
    }

    const started = performance.now();
    const { body } = await teacher.session
      .get(`/api/v1/assessment/classes/${schoolClass.id}/gradebook`)
      .expect(200);
    expect(performance.now() - started).toBeLessThan(1500);
    expect(body.students).toHaveLength(40);
    expect(body.grades).toHaveLength(1200);
  }, 120_000);

  it.each([
    [
      'grading_scales',
      `INSERT INTO grading_scales (id, name, kind) VALUES ($1, 'Probe', 'percentage')`,
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
