import type { INestApplication } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { v7 as uuidv7 } from 'uuid';
import { TenantTransactions } from '../src/common/tenancy/tenant-transactions.js';
import { AuditEvent } from '../src/modules/audit/audit-event.entity.js';
import { createTestApp } from './support/create-test-app.js';
import { createSchool } from './support/identity.js';

describe('Student data requests (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('exports everything about a student, then erases it from every module', async () => {
    const school = await createSchool(app);
    const post = async (path: string, body: object) =>
      (await school.admin.post(`/api/v1${path}`).send(body).expect(201)).body;
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
    const student = await post('/students', {
      studentNumber: `S-${uuidv7().slice(-6)}`,
      firstName: 'Amira',
      lastName: 'Haddad',
    });
    const sibling = await post('/students', {
      studentNumber: `S-${uuidv7().slice(-6)}`,
      firstName: 'Yasmine',
      lastName: 'Haddad',
    });
    const onlyChild = await post('/guardians', {
      firstName: 'Only',
      lastName: 'Parent',
      email: `only-${uuidv7().slice(-6)}@example.test`,
    });
    const shared = await post('/guardians', {
      firstName: 'Shared',
      lastName: 'Parent',
      email: `shared-${uuidv7().slice(-6)}@example.test`,
    });
    await post(`/students/${student.id}/guardians`, {
      guardianId: onlyChild.id,
      relationship: 'mother',
    });
    await post(`/students/${student.id}/guardians`, {
      guardianId: shared.id,
      relationship: 'father',
    });
    await post(`/students/${sibling.id}/guardians`, {
      guardianId: shared.id,
      relationship: 'father',
    });
    await post(`/academics/classes/${schoolClass.id}/students`, {
      studentIds: [student.id],
    });

    const { body: bundle } = await school.admin
      .get(`/api/v1/privacy/students/${student.id}/export`)
      .expect(200);
    expect(bundle).toMatchObject({
      student: {
        firstName: 'Amira',
        guardians: [expect.anything(), expect.anything()],
        classes: [expect.objectContaining({ code: '7A' })],
      },
      grades: [
        expect.objectContaining({
          class: expect.objectContaining({ code: '7A' }),
        }),
      ],
      attendance: { sessions: 0 },
      portfolio: [],
      files: [],
    });

    await school.admin
      .delete(`/api/v1/privacy/students/${student.id}`)
      .expect(204);
    await school.admin.get(`/api/v1/students/${student.id}`).expect(404);
    await school.admin.get(`/api/v1/guardians/${onlyChild.id}`).expect(404);
    await school.admin.get(`/api/v1/guardians/${shared.id}`).expect(200);
    const { body: roster } = await school.admin
      .get(`/api/v1/academics/classes/${schoolClass.id}/students`)
      .expect(200);
    expect(roster).toEqual([]);

    const txHost =
      app.get<TransactionHost<TransactionalAdapterTypeOrm>>(TransactionHost);
    const events = await app
      .get(TenantTransactions)
      .runInSchool(school.id, () =>
        txHost.tx.find(AuditEvent, { where: { entityId: student.id } }),
      );
    expect(events.map((event) => event.action)).toEqual(
      expect.arrayContaining(['student.exported', 'student.erased']),
    );
  });
});
