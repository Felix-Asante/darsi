import type { INestApplication } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { ClsService } from 'nestjs-cls';
import { DataSource } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { inject } from 'vitest';
import { enableTenantIsolation } from '../src/database/rls.js';
import { buildDataSourceOptions } from '../src/database/typeorm.options.js';
import { createTestApp } from './support/create-test-app.js';
import { expectTenantIsolation } from './support/tenant-isolation.js';

describe('Tenant isolation (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const owner = await new DataSource(
      buildDataSourceOptions(inject('migratorUrl')),
    ).initialize();
    await owner.query(`DROP TABLE IF EXISTS isolation_probe`);
    await owner.query(
      `CREATE TABLE isolation_probe (id uuid PRIMARY KEY, school_id uuid NOT NULL, label text)`,
    );
    await enableTenantIsolation(owner.createQueryRunner(), 'isolation_probe');
    await owner.destroy();

    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps every school inside its own rows, enforced by the database', async () => {
    const txHost =
      app.get<TransactionHost<TransactionalAdapterTypeOrm>>(TransactionHost);

    await expectTenantIsolation(app, {
      table: 'isolation_probe',
      insertRow: async () => {
        const id = uuidv7();
        await txHost.tx.query(
          `INSERT INTO isolation_probe (id, label) VALUES ($1, 'probe')`,
          [id],
        );
        return id;
      },
    });
  });

  it('refuses to insert a row without a school', async () => {
    const txHost =
      app.get<TransactionHost<TransactionalAdapterTypeOrm>>(TransactionHost);

    await expect(
      app
        .get(ClsService)
        .run(() =>
          txHost.withTransaction(() =>
            txHost.tx.query(
              `INSERT INTO isolation_probe (id, label) VALUES ($1, 'orphan')`,
              [uuidv7()],
            ),
          ),
        ),
    ).rejects.toThrow(/null value in column "school_id"|row-level security/);
  });

  /** Catches a migration that forgets `enableTenantIsolation()`, in any module. */
  it('puts every table with a school_id under forced row-level security', async () => {
    const txHost =
      app.get<TransactionHost<TransactionalAdapterTypeOrm>>(TransactionHost);
    const tables = await txHost.tx.query<
      {
        table: string;
        enabled: boolean;
        forced: boolean;
        policy: string | null;
      }[]
    >(
      `SELECT c.relname AS table, c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced, p.polname AS policy
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
         JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'school_id' AND NOT a.attisdropped
         LEFT JOIN pg_policy p ON p.polrelid = c.oid AND p.polname = 'tenant_isolation'
        WHERE c.relkind = 'r'
        ORDER BY c.relname`,
    );
    expect(tables.length).toBeGreaterThan(50);
    expect(
      tables.filter(
        (table) => !table.enabled || !table.forced || !table.policy,
      ),
    ).toEqual([]);
    expect(tables.map((table) => table.table)).toEqual(
      expect.arrayContaining([
        'invoices',
        'payments',
        'applications',
        'application_notes',
        're_enrolments',
      ]),
    );
  });
});
