import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './support/create-test-app.js';
import { addMember, createSchool } from './support/identity.js';

const text = (value: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }],
});

describe('Unit and lesson planning (e2e)', () => {
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
    const year = await post('/academics/years', {
      name: 'Year',
      startsOn: '2026-09-01',
      endsOn: '2027-07-02',
    });
    const classA = await post('/academics/classes', {
      academicYearId: year.id,
      code: 'S7A',
      name: 'Science 7A',
    });
    const classB = await post('/academics/classes', {
      academicYearId: year.id,
      code: 'S7B',
      name: 'Science 7B',
    });
    const teacher = await addMember(app, school, ['teacher']);
    const coTeacher = await addMember(app, school, ['teacher']);
    const assistant = await addMember(app, school, ['teaching_assistant']);
    const stranger = await addMember(app, school, ['teacher']);
    for (const schoolClass of [classA, classB]) {
      await school.admin
        .put(`/api/v1/academics/classes/${schoolClass.id}/staff`)
        .send({ staff: [{ userId: teacher.userId, role: 'teacher' }] })
        .expect(200);
    }
    const template = await post('/planning/templates', {
      name: 'MYP unit planner',
      fields: [
        { key: 'inquiry', label: 'Statement of inquiry', kind: 'text' },
        { key: 'reflection', label: 'Reflection', kind: 'richtext' },
      ],
    });
    return {
      school,
      classA,
      classB,
      teacher,
      coTeacher,
      assistant,
      stranger,
      template,
      post,
    };
  }

  it('plans a unit from a template for several classes, shares it, and attributes edits (PLN-1/2/3/4)', async () => {
    const {
      classA,
      classB,
      teacher,
      coTeacher,
      assistant,
      stranger,
      template,
      post,
    } = await setUp();
    const unit = await post(
      '/planning/units',
      {
        title: 'Ecosystems',
        templateId: template.id,
        startsOn: '2026-11-02',
        endsOn: '2026-12-11',
        objectives: text('Explain food webs'),
        fieldValues: {
          inquiry: 'Systems depend on balance',
          reflection: text('Went well'),
          unknown: 'dropped',
        },
        classIds: [classA.id, classB.id],
      },
      teacher.session,
    );
    expect(unit).toMatchObject({
      access: 'owner',
      fieldValues: {
        inquiry: 'Systems depend on balance',
        reflection: text('Went well'),
      },
      classes: [
        expect.objectContaining({ code: 'S7A' }),
        expect.objectContaining({ code: 'S7B' }),
      ],
    });
    expect(unit.fieldValues).not.toHaveProperty('unknown');

    await teacher.session
      .put(`/api/v1/planning/units/${unit.id}/collaborators`)
      .send({
        collaborators: [
          { userId: coTeacher.userId, role: 'editor' },
          { userId: assistant.userId, role: 'viewer' },
        ],
      })
      .expect(200);

    const { body: withLesson } = await coTeacher.session
      .post(`/api/v1/planning/units/${unit.id}/lessons`)
      .send({
        title: 'Food chains',
        date: '2026-11-03',
        activities: text('Card sort'),
        resources: text('Worksheet'),
      })
      .expect(201);
    expect(withLesson.lessons[0]).toMatchObject({
      title: 'Food chains',
      updatedBy: { id: coTeacher.userId },
    });
    expect(withLesson.updatedBy.id).toBe(coTeacher.userId);

    await assistant.session
      .post(`/api/v1/planning/units/${unit.id}/lessons`)
      .send({ title: 'Nope' })
      .expect(403);
    await assistant.session
      .get(`/api/v1/planning/units/${unit.id}`)
      .expect(200);
    await stranger.session.get(`/api/v1/planning/units/${unit.id}`).expect(403);

    const { body: shared } = await coTeacher.session
      .get('/api/v1/planning/units')
      .expect(200);
    expect(shared).toEqual([
      expect.objectContaining({ title: 'Ecosystems', lessonCount: 1 }),
    ]);
    const { body: forClass } = await teacher.session
      .get(`/api/v1/planning/classes/${classB.id}/units`)
      .expect(200);
    expect(forClass).toHaveLength(1);

    const { body: invalid } = await teacher.session
      .put(`/api/v1/planning/units/${unit.id}`)
      .send({
        title: 'Ecosystems',
        classIds: [classA.id],
        objectives: { type: 'paragraph' },
      })
      .expect(400);
    expect(invalid.errors).toEqual([
      { field: 'objectives', codes: ['notADocument'] },
    ]);
  });

  it('links assessments of its classes and copies to next year with dates moved (PLN-5/6)', async () => {
    const { school, classA, classB, teacher, post } = await setUp();
    const scale = await post('/grading/scales', {
      name: 'Marks',
      preset: 'french_20',
    });
    const { body: assessment } = await teacher.session
      .post(`/api/v1/assessment/classes/${classA.id}/assessments`)
      .send({ title: 'Ecosystems test', kind: 'summative', scaleId: scale.id })
      .expect(201);
    const unit = await post(
      '/planning/units',
      { title: 'Ecosystems', startsOn: '2026-11-02', classIds: [classA.id] },
      teacher.session,
    );
    await teacher.session
      .post(`/api/v1/planning/units/${unit.id}/lessons`)
      .send({ title: 'Lesson 1', date: '2026-11-03' })
      .expect(201);

    const { body: linked } = await teacher.session
      .put(`/api/v1/planning/units/${unit.id}/assessments`)
      .send({ assessmentIds: [assessment.id] })
      .expect(200);
    expect(linked.assessmentIds).toEqual([assessment.id]);

    const { body: copy } = await teacher.session
      .post(`/api/v1/planning/units/${unit.id}/copy`)
      .send({ classIds: [classB.id], shiftDays: 364 })
      .expect(201);
    expect(copy).toMatchObject({
      title: 'Ecosystems',
      startsOn: '2027-11-01',
      classes: [expect.objectContaining({ code: 'S7B' })],
      lessons: [
        expect.objectContaining({ title: 'Lesson 1', date: '2027-11-02' }),
      ],
      assessmentIds: [],
    });
    expect(copy.id).not.toBe(unit.id);
    expect(school.id).toBeTruthy();
  });
});
