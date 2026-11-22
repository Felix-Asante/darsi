import type { INestApplication } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { v7 as uuidv7 } from 'uuid';
import { addDays, todayIn } from '../src/common/dates/calendar-date.js';
import { TenantTransactions } from '../src/common/tenancy/tenant-transactions.js';
import { EnrolmentService } from '../src/modules/admissions/enrolment.service.js';
import { AuditEvent } from '../src/modules/audit/audit-event.entity.js';
import { FilesService } from '../src/modules/files/files.service.js';
import { ObjectStorage } from '../src/modules/files/object-storage.service.js';
import { createTestApp } from './support/create-test-app.js';
import {
  type Agent,
  addMember,
  agent,
  createSchool,
  type CreatedSchool,
  deliverMail,
  mailbox,
  signUp,
  uniqueEmail,
} from './support/identity.js';

describe('Admissions and enrolment (e2e)', () => {
  let app: INestApplication;
  const today = todayIn('Europe/Paris');

  beforeAll(async () => {
    app = await createTestApp();
    await app.get(ObjectStorage).ensureBucket();
  });

  afterAll(async () => {
    await app.close();
  });

  const inSchool = <T>(school: CreatedSchool, work: () => Promise<T>) =>
    app.get(TenantTransactions).runInSchool(school.id, work);
  const txHost = () =>
    app.get<TransactionHost<TransactionalAdapterTypeOrm>>(TransactionHost);

  async function setUp(places = 2) {
    const school = await createSchool(app);
    const post = async (path: string, body: object) =>
      (await school.admin.post(`/api/v1${path}`).send(body).expect(201)).body;
    const year = await post('/academics/years', {
      name: 'This year',
      startsOn: addDays(today, -60),
      endsOn: addDays(today, 240),
    });
    const division = await post('/academics/divisions', {
      name: 'Middle School',
    });
    const grade6 = await post('/academics/grade-levels', {
      divisionId: division.id,
      name: 'Grade 6',
    });
    const grade7 = await post('/academics/grade-levels', {
      divisionId: division.id,
      name: 'Grade 7',
    });
    const officer = await addMember(app, school, ['admissions_officer']);
    const finance = await addMember(app, school, ['finance_officer']);
    const { body: deposit } = await finance.session
      .post('/api/v1/billing/fee-items')
      .send({
        name: 'Enrolment deposit',
        kind: 'deposit',
        amount: '100000',
        taxRateBp: 0,
      })
      .expect(201);
    const { body: cycle } = await officer.session
      .post('/api/v1/admissions/cycles')
      .send({
        academicYearId: year.id,
        name: 'Entry 2027',
        opensOn: addDays(today, -1),
        closesOn: addDays(today, 30),
        grades: [{ gradeLevelId: grade7.id, places }],
        applicationFee: '5000',
        depositFeeItemId: deposit.id,
      })
      .expect(201);
    await officer.session
      .put('/api/v1/admissions/forms')
      .send({
        fields: [
          {
            key: 'previous_school',
            label: { en: 'Previous school', fr: 'École précédente' },
            type: 'text',
            required: true,
          },
        ],
        documents: [
          {
            key: 'birth_certificate',
            label: { en: 'Birth certificate', fr: 'Acte de naissance' },
            required: true,
          },
        ],
      })
      .expect(200);
    const { body: stages } = await officer.session
      .get('/api/v1/admissions/stages')
      .expect(200);
    stages.find((stage: { kind: string }) => stage.kind === 'offered').email = {
      en: {
        subject: 'An offer for {student}',
        body: 'We are delighted to offer {student} a place at {school}.\n\nPlease reply by {expires}.',
      },
      fr: {
        subject: 'Une place pour {student}',
        body: '{school} a le plaisir de proposer une place à {student}.\n\nMerci de répondre avant le {expires}.',
      },
    };
    await officer.session
      .put('/api/v1/admissions/stages')
      .send({
        stages: stages.map(
          ({ id, name, kind, email }: Record<string, unknown>) => ({
            id,
            name,
            kind,
            email,
          }),
        ),
      })
      .expect(200);
    return {
      school,
      year,
      grade6,
      grade7,
      officer,
      finance,
      cycle,
      stages,
      deposit,
    };
  }

  async function uploadDocument(
    session: Agent,
    school: CreatedSchool,
    applicationId: string,
  ) {
    const content = '%PDF-1.4 birth certificate';
    const { body: upload } = await session
      .post('/api/v1/files/uploads')
      .send({
        name: 'birth.pdf',
        contentType: 'application/pdf',
        size: Buffer.byteLength(content),
        target: { type: 'application', applicationId },
      })
      .expect(201);
    const put = await fetch(upload.uploadUrl, {
      method: 'PUT',
      body: content,
      headers: { 'content-type': 'application/pdf' },
    });
    expect(put.status).toBe(200);
    await session.post(`/api/v1/files/${upload.file.id}/complete`).expect(200);
    await app
      .get(FilesService)
      .scan({ schoolId: school.id, fileId: upload.file.id });
    return upload.file.id as string;
  }

  async function apply(
    school: CreatedSchool,
    cycleId: string,
    gradeLevelId: string,
    email = uniqueEmail('family'),
    firstName = 'Amira',
  ) {
    const session = await signUp(app, email, 'Nadia Haddad');
    const { body: joined } = await session
      .post('/api/v1/admissions/join')
      .set('X-School-Slug', school.slug)
      .expect(200);
    const details = {
      cycleId,
      gradeLevelId,
      studentFirstName: firstName,
      studentLastName: 'Haddad',
      studentDateOfBirth: '2014-03-02',
      guardianFirstName: 'Nadia',
      guardianLastName: 'Haddad',
      guardianPhone: '+33 6 00 00 00 00',
      guardianRelationship: 'mother',
      answers: {
        previous_school: 'École Jules Ferry',
        unknown_question: 'dropped',
      },
    };
    const { body: draft } = await session
      .post('/api/v1/admissions/my-applications')
      .send(details)
      .expect(201);
    return { session, email, draft, details, roles: joined.roles };
  }

  it('takes a family from the public page to an enrolled, billed student (ADMS-1–ADMS-12)', async () => {
    const { school, grade7, officer, cycle, stages } = await setUp();

    const { body: page } = await agent(app)
      .get('/api/v1/admissions/public')
      .set('X-School-Slug', school.slug)
      .expect(200);
    expect(page).toMatchObject({
      school: { name: 'Greenfield School' },
      cycles: [
        {
          id: cycle.id,
          applicationFee: '5000',
          grades: [{ id: grade7.id, name: 'Grade 7' }],
        },
      ],
    });

    const {
      session: family,
      email,
      draft,
      roles,
    } = await apply(school, cycle.id, grade7.id);
    expect(roles).toEqual(['applicant']);
    expect(draft).toMatchObject({
      status: 'draft',
      stage: null,
      answers: { previous_school: 'École Jules Ferry' },
    });
    expect(draft.answers).not.toHaveProperty('unknown_question');
    expect(draft.form.documents).toEqual([
      expect.objectContaining({ key: 'birth_certificate', required: true }),
    ]);

    const { body: incomplete } = await family
      .post(`/api/v1/admissions/my-applications/${draft.id}/submit`)
      .expect(422);
    expect(incomplete.errors).toEqual([
      { field: 'documents.birth_certificate', codes: ['required'] },
    ]);
    const fileId = await uploadDocument(family, school, draft.id);
    await family
      .put(
        `/api/v1/admissions/my-applications/${draft.id}/documents/birth_certificate`,
      )
      .send({ fileId })
      .expect(200);
    const { body: submitted } = await family
      .post(`/api/v1/admissions/my-applications/${draft.id}/submit`)
      .expect(200);
    expect(submitted).toMatchObject({
      status: 'submitted',
      stage: { kind: 'submitted' },
    });
    expect(submitted.feeInvoiceId).toBeTruthy();
    await family
      .put(`/api/v1/admissions/my-applications/${draft.id}`)
      .send({ cycleId: cycle.id, gradeLevelId: grade7.id })
      .expect(409);

    // The application fee is an ordinary invoice the family can see and pay (ADMS-10).
    const { body: statements } = await family
      .get('/api/v1/billing/statements')
      .expect(200);
    expect(statements[0].invoices).toEqual([
      expect.objectContaining({
        id: submitted.feeInvoiceId,
        total: '5000',
        state: 'open',
      }),
    ]);

    // Staff notes stay with staff (ADMS-7); academic staff never see applications.
    const teacher = await addMember(app, school, ['teacher']);
    await teacher.session.get('/api/v1/admissions/applications').expect(403);
    await family.get('/api/v1/admissions/applications').expect(403);
    const { body: list } = await officer.session
      .get(`/api/v1/admissions/applications?cycleId=${cycle.id}`)
      .expect(200);
    expect(list).toEqual([
      expect.objectContaining({
        id: draft.id,
        student: expect.objectContaining({ firstName: 'Amira' }),
        notes: 0,
      }),
    ]);
    await officer.session
      .post(`/api/v1/admissions/applications/${draft.id}/notes`)
      .send({ kind: 'rating', body: 'Strong interview', rating: 4 })
      .expect(201);
    const { body: own } = await family
      .get(`/api/v1/admissions/my-applications/${draft.id}`)
      .expect(200);
    expect(JSON.stringify(own)).not.toContain('Strong interview');

    // An offer needs an expiry date and sends the stage's email in the family's language (ADMS-8, ADMS-9).
    const offered = stages.find(
      (stage: { kind: string }) => stage.kind === 'offered',
    );
    await officer.session
      .post(`/api/v1/admissions/applications/${draft.id}/move`)
      .send({ stageId: offered.id })
      .expect(422);
    await officer.session
      .post(`/api/v1/admissions/applications/${draft.id}/move`)
      .send({ stageId: offered.id, offerExpiresOn: addDays(today, 14) })
      .expect(200);
    await deliverMail(app);
    const offer = mailbox(app)
      .filter({ to: email })
      .find((mail) => mail.subject === 'An offer for Amira Haddad');
    expect(offer).toBeDefined();

    await family
      .post(`/api/v1/admissions/my-applications/${draft.id}/offer`)
      .send({ response: 'accepted' })
      .expect(200);
    await family
      .post(`/api/v1/admissions/my-applications/${draft.id}/offer`)
      .send({ response: 'accepted' })
      .expect(409);
    await deliverMail(app);

    // Acceptance: exactly one student, the documents on their record for staff only, a deposit invoice, audited (ADMS-11, ADMS-12).
    const { body: enrolled } = await officer.session
      .get(`/api/v1/admissions/applications/${draft.id}`)
      .expect(200);
    expect(enrolled.stage.kind).toBe('enrolled');
    expect(enrolled.studentId).toBeTruthy();
    await inSchool(school, () =>
      app
        .get(EnrolmentService)
        .onAccepted({ schoolId: school.id, applicationId: draft.id }),
    );
    const students = await inSchool(school, () =>
      txHost().tx.query<
        { id: string; grade_level_id: string; family_id: string }[]
      >(
        `SELECT id, grade_level_id, family_id FROM students WHERE last_name = 'Haddad'`,
      ),
    );
    expect(students).toEqual([
      {
        id: enrolled.studentId,
        grade_level_id: grade7.id,
        family_id: enrolled.familyId,
      },
    ]);
    const { body: files } = await school.admin
      .get(`/api/v1/students/${enrolled.studentId}/files`)
      .expect(200);
    expect(files).toEqual([
      expect.objectContaining({
        title: 'Birth certificate',
        visibleToFamily: false,
      }),
    ]);

    const { body: me } = await family.get('/api/v1/me').expect(200);
    expect(me.currentSchool.roles).toEqual(['guardian']);
    const { body: after } = await family
      .get('/api/v1/billing/statements')
      .expect(200);
    expect(
      after[0].invoices
        .map((invoice: { total: string }) => invoice.total)
        .sort(),
    ).toEqual(['100000', '5000']);
    const { body: profile } = await family
      .get(`/api/v1/students/${enrolled.studentId}`)
      .expect(200);
    expect(profile).toMatchObject({
      firstName: 'Amira',
      dateOfBirth: '2014-03-02',
    });
    await family.get(`/api/v1/files/${fileId}/download`).expect(403);

    const audit = await inSchool(school, () =>
      txHost().tx.find(AuditEvent, { where: { entityId: draft.id } }),
    );
    expect(audit.map((event) => event.action)).toEqual(
      expect.arrayContaining([
        'application.submitted',
        'application.stage_changed',
        'application.offer_accepted',
        'application.enrolled',
      ]),
    );
  });

  it('keeps places, expiry and decisions in the right hands', async () => {
    const { school, grade7, officer, cycle, stages } = await setUp(1);
    const offered = stages.find(
      (stage: { kind: string }) => stage.kind === 'offered',
    );
    const ids: string[] = [];
    for (const name of ['First', 'Second']) {
      const { session, draft } = await apply(
        school,
        cycle.id,
        grade7.id,
        uniqueEmail(name.toLowerCase()),
        name,
      );
      const fileId = await uploadDocument(session, school, draft.id);
      await session
        .put(
          `/api/v1/admissions/my-applications/${draft.id}/documents/birth_certificate`,
        )
        .send({ fileId })
        .expect(200);
      await session
        .post(`/api/v1/admissions/my-applications/${draft.id}/submit`)
        .expect(200);
      ids.push(draft.id);
    }
    const move = (id: string) =>
      officer.session
        .post(`/api/v1/admissions/applications/${id}/move`)
        .send({ stageId: offered.id, offerExpiresOn: addDays(today, 7) });
    await move(ids[0]).expect(200);
    const { body: full } = await move(ids[1]).expect(409);
    expect(full.code).toBe('no_places_left');

    // The school admin reads applications but does not decide them (PRD permissions matrix).
    await school.admin
      .get(`/api/v1/admissions/applications/${ids[1]}`)
      .expect(200);
    await school.admin
      .post(`/api/v1/admissions/applications/${ids[1]}/move`)
      .send({ stageId: offered.id, offerExpiresOn: addDays(today, 7) })
      .expect(403);
  });

  it('puts a sibling in the family of the guardian who applies (ADMS-11)', async () => {
    const { school, grade7, officer, cycle, stages } = await setUp();
    const parentEmail = uniqueEmail('parent');
    const { body: older } = await school.admin
      .post('/api/v1/students')
      .send({
        studentNumber: `S-${uuidv7().slice(-8)}`,
        firstName: 'Yasmine',
        lastName: 'Haddad',
      })
      .expect(201);
    const { body: guardian } = await school.admin
      .post('/api/v1/guardians')
      .send({ firstName: 'Nadia', lastName: 'Haddad', email: parentEmail })
      .expect(201);
    await school.admin
      .post(`/api/v1/students/${older.id}/guardians`)
      .send({ guardianId: guardian.id, relationship: 'mother' })
      .expect(201);
    const parent = await addMember(app, school, ['guardian'], parentEmail);
    await deliverMail(app);

    const { body: joined } = await parent.session
      .post('/api/v1/admissions/join')
      .set('X-School-Slug', school.slug)
      .expect(200);
    expect(joined.roles.sort()).toEqual(['applicant', 'guardian']);
    const { body: draft } = await parent.session
      .post('/api/v1/admissions/my-applications')
      .send({
        cycleId: cycle.id,
        gradeLevelId: grade7.id,
        studentFirstName: 'Sami',
        studentLastName: 'Haddad',
        studentDateOfBirth: '2015-06-01',
        guardianFirstName: 'Nadia',
        guardianLastName: 'Haddad',
        guardianRelationship: 'mother',
        answers: { previous_school: 'École Jules Ferry' },
      })
      .expect(201);
    const fileId = await uploadDocument(parent.session, school, draft.id);
    await parent.session
      .put(
        `/api/v1/admissions/my-applications/${draft.id}/documents/birth_certificate`,
      )
      .send({ fileId })
      .expect(200);
    await parent.session
      .post(`/api/v1/admissions/my-applications/${draft.id}/submit`)
      .expect(200);
    const offered = stages.find(
      (stage: { kind: string }) => stage.kind === 'offered',
    );
    await officer.session
      .post(`/api/v1/admissions/applications/${draft.id}/move`)
      .send({ stageId: offered.id, offerExpiresOn: addDays(today, 7) })
      .expect(200);
    await parent.session
      .post(`/api/v1/admissions/my-applications/${draft.id}/offer`)
      .send({ response: 'accepted' })
      .expect(200);
    await deliverMail(app);

    const families = await inSchool(school, () =>
      txHost().tx.query<{ first_name: string; family_id: string }[]>(
        `SELECT first_name, family_id FROM students WHERE last_name = 'Haddad' ORDER BY first_name`,
      ),
    );
    expect(families.map((row) => row.first_name)).toEqual(['Sami', 'Yasmine']);
    expect(new Set(families.map((row) => row.family_id)).size).toBe(1);
    const guardians = await inSchool(school, () =>
      txHost().tx.query(`SELECT id FROM guardians WHERE email = $1`, [
        parentEmail,
      ]),
    );
    expect(guardians).toHaveLength(1);
    const { body: me } = await parent.session.get('/api/v1/me').expect(200);
    expect(me.currentSchool.roles).toEqual(['guardian']);
  });

  it('confirms next year online, moves confirmed students up, and records withdrawals (ADMS-13, ADMS-14)', async () => {
    const school = await createSchool(app);
    const post = async (path: string, body: object) =>
      (await school.admin.post(`/api/v1${path}`).send(body).expect(201)).body;
    const year = await post('/academics/years', {
      name: 'This year',
      startsOn: addDays(today, -60),
      endsOn: addDays(today, 240),
    });
    const nextYear = await post('/academics/years', {
      name: 'Next year',
      startsOn: addDays(today, 300),
      endsOn: addDays(today, 600),
    });
    const division = await post('/academics/divisions', {
      name: 'Middle School',
    });
    const grade6 = await post('/academics/grade-levels', {
      divisionId: division.id,
      name: 'Grade 6',
    });
    const grade7 = await post('/academics/grade-levels', {
      divisionId: division.id,
      name: 'Grade 7',
    });
    const schoolClass = await post('/academics/classes', {
      academicYearId: year.id,
      code: '6A',
      name: 'Class 6A',
      gradeLevelId: grade6.id,
    });
    const tag = uuidv7().slice(-6);
    const staying = await post('/students', {
      studentNumber: `S-${tag}`,
      firstName: 'Lina',
      lastName: 'Martin',
      gradeLevelId: grade6.id,
    });
    const leaving = await post('/students', {
      studentNumber: `L-${tag}`,
      firstName: 'Omar',
      lastName: 'Martin',
      gradeLevelId: grade7.id,
    });
    await post(`/academics/classes/${schoolClass.id}/students`, {
      studentIds: [staying.id],
    });
    const parentEmail = uniqueEmail('parent');
    const guardian = await post('/guardians', {
      firstName: 'Claire',
      lastName: 'Martin',
      email: parentEmail,
    });
    await post(`/students/${staying.id}/guardians`, {
      guardianId: guardian.id,
      relationship: 'mother',
    });
    const parent = await addMember(app, school, ['guardian'], parentEmail);
    await deliverMail(app);

    await school.admin
      .post('/api/v1/admissions/re-enrolments')
      .send({ academicYearId: year.id })
      .expect(409);
    const { body: started } = await school.admin
      .post('/api/v1/admissions/re-enrolments')
      .send({ academicYearId: nextYear.id })
      .expect(200);
    expect(started).toEqual({ created: 2, skipped: 0 });
    const { body: again } = await school.admin
      .post('/api/v1/admissions/re-enrolments')
      .send({ academicYearId: nextYear.id })
      .expect(200);
    expect(again.created).toBe(0);

    const { body: mine } = await parent.session
      .get('/api/v1/admissions/re-enrolments/mine')
      .expect(200);
    expect(mine).toEqual([
      expect.objectContaining({
        student: expect.objectContaining({ id: staying.id }),
        nextGradeLevel: { id: grade7.id, name: 'Grade 7' },
        status: 'pending',
      }),
    ]);
    const { body: all } = await school.admin
      .get(`/api/v1/admissions/re-enrolments?academicYearId=${nextYear.id}`)
      .expect(200);
    const omar = all.find(
      (entry: { student: { id: string } }) => entry.student.id === leaving.id,
    );
    expect(omar.nextGradeLevel).toBeNull();
    await parent.session
      .post(`/api/v1/admissions/re-enrolments/${omar.id}/respond`)
      .send({ response: 'confirmed' })
      .expect(403);
    await parent.session
      .post(`/api/v1/admissions/re-enrolments/${mine[0].id}/respond`)
      .send({ response: 'confirmed' })
      .expect(200);

    const { body: applied } = await school.admin
      .post('/api/v1/admissions/re-enrolments/apply')
      .send({ academicYearId: nextYear.id })
      .expect(200);
    expect(applied).toEqual({ applied: 1 });
    const { body: moved } = await school.admin
      .get(`/api/v1/students/${staying.id}`)
      .expect(200);
    expect(moved.gradeLevel.id).toBe(grade7.id);

    const leavingOn = addDays(today, 5);
    await school.admin
      .post(`/api/v1/admissions/students/${staying.id}/withdrawal`)
      .send({ leavingOn, reason: 'Moving abroad' })
      .expect(204);
    await school.admin
      .post(`/api/v1/admissions/students/${staying.id}/withdrawal`)
      .send({ leavingOn, reason: 'Again' })
      .expect(409);
    const [record] = await inSchool(school, () =>
      txHost().tx.query<
        { status: string; withdrawn_on: string; ends_on: string }[]
      >(
        `SELECT s.status, s.withdrawn_on::text, e.ends_on::text FROM students s JOIN enrolments e ON e.student_id = s.id WHERE s.id = $1`,
        [staying.id],
      ),
    );
    expect(record).toEqual({
      status: 'withdrawn',
      withdrawn_on: leavingOn,
      ends_on: leavingOn,
    });
  });
});
