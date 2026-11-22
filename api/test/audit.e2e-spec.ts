import type { INestApplication } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { v7 as uuidv7 } from 'uuid';
import { TenantTransactions } from '../src/common/tenancy/tenant-transactions.js';
import { AuditEvent } from '../src/modules/audit/audit-event.entity.js';
import { AuditService } from '../src/modules/audit/audit.service.js';
import { createTestApp } from './support/create-test-app.js';
import { expectTenantIsolation } from './support/tenant-isolation.js';

describe('Audit log (e2e)', () => {
  let app: INestApplication;
  let transactions: TenantTransactions;
  let audit: AuditService;
  let txHost: TransactionHost<TransactionalAdapterTypeOrm>;

  beforeAll(async () => {
    app = await createTestApp();
    transactions = app.get(TenantTransactions);
    audit = app.get(AuditService);
    txHost = app.get(TransactionHost);
  });

  afterAll(async () => {
    await app.close();
  });

  it('stores only what changed, in the current school', async () => {
    const schoolId = uuidv7();
    const entityId = uuidv7();

    const [event] = await transactions.runInSchool(schoolId, async () => {
      await audit.record({
        action: 'grade.updated',
        entityType: 'grade',
        entityId,
        before: { value: '5', comment: 'Good' },
        after: { value: '6', comment: 'Good' },
      });
      return txHost.tx.find(AuditEvent, { where: { entityId } });
    });

    expect(event).toMatchObject({
      schoolId,
      action: 'grade.updated',
      diff: { value: { before: '5', after: '6' } },
    });
  });

  it('rolls back with the change it describes', async () => {
    const schoolId = uuidv7();
    const entityId = uuidv7();

    await expect(
      transactions.runInSchool(schoolId, async () => {
        await audit.record({
          action: 'invoice.issued',
          entityType: 'invoice',
          entityId,
        });
        throw new Error('issuing failed');
      }),
    ).rejects.toThrow('issuing failed');

    const events = await transactions.runInSchool(schoolId, () =>
      txHost.tx.find(AuditEvent, { where: { entityId } }),
    );
    expect(events).toHaveLength(0);
  });

  it('is append-only for the application', async () => {
    const schoolId = uuidv7();
    await transactions.runInSchool(schoolId, () =>
      audit.record({ action: 'role.granted', entityType: 'membership' }),
    );

    await expect(
      transactions.runInSchool(schoolId, () =>
        txHost.tx.query(`UPDATE audit_events SET action = 'tampered'`),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      transactions.runInSchool(schoolId, () =>
        txHost.tx.query(`DELETE FROM audit_events`),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it('is isolated per school', async () => {
    await expectTenantIsolation(app, {
      table: 'audit_events',
      appendOnly: true,
      insertRow: async () => {
        const entityId = uuidv7();
        await audit.record({
          action: 'probe.created',
          entityType: 'probe',
          entityId,
        });
        const [event] = await txHost.tx.find(AuditEvent, {
          where: { entityId },
        });
        return event.id;
      },
    });
  });
});
