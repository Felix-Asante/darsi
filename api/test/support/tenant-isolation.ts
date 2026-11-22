import type { INestApplication } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { ClsService } from 'nestjs-cls';
import { v7 as uuidv7 } from 'uuid';
import { expect } from 'vitest';
import { TenantTransactions } from '../../src/common/tenancy/tenant-transactions.js';

export interface TenantIsolationCase {
  table: string;
  /** Inserts one row for the current school (the context is already set) and returns its id. */
  insertRow: () => Promise<string>;
  /** Tables the runtime role can only insert into, such as the audit log. */
  appendOnly?: boolean;
}

/**
 * Every tenant table runs through this. It proves that row-level security,
 * not application code, keeps one school's rows away from another.
 */
export async function expectTenantIsolation(
  app: INestApplication,
  { table, insertRow, appendOnly = false }: TenantIsolationCase,
) {
  const transactions = app.get(TenantTransactions);
  const txHost =
    app.get<TransactionHost<TransactionalAdapterTypeOrm>>(TransactionHost);
  const schoolA = uuidv7();
  const schoolB = uuidv7();
  const count = async () =>
    Number(
      (
        await txHost.tx.query<{ count: string }[]>(
          `SELECT count(*) FROM "${table}"`,
        )
      )[0].count,
    );

  const rowId = await transactions.runInSchool(schoolA, insertRow);

  await transactions.runInSchool(schoolA, async () => {
    const [row] = await txHost.tx.query<{ school_id: string }[]>(
      `SELECT school_id FROM "${table}" WHERE id = $1`,
      [rowId],
    );
    expect(row?.school_id, 'the row defaults to the current school').toBe(
      schoolA,
    );
  });

  await transactions.runInSchool(schoolB, async () => {
    expect(await count(), 'another school sees none of its rows').toBe(0);
  });

  const withoutSchool = await app
    .get(ClsService)
    .run(() => txHost.withTransaction(count));
  expect(withoutSchool, 'without a school, nothing is visible').toBe(0);

  if (appendOnly) return;

  await transactions.runInSchool(schoolB, async () => {
    const updated = await txHost.tx.query(
      `UPDATE "${table}" SET school_id = school_id WHERE id = $1`,
      [rowId],
    );
    expect(updated[1], 'another school cannot update its rows').toBe(0);
  });

  await expect(
    transactions.runInSchool(schoolB, () =>
      txHost.tx.query(`UPDATE "${table}" SET school_id = $1`, [schoolA]),
    ),
    'a school cannot write rows into another school',
  ).resolves.toEqual([[], 0]);

  await expect(
    transactions.runInSchool(schoolA, () =>
      txHost.tx.query(`UPDATE "${table}" SET school_id = $1 WHERE id = $2`, [
        schoolB,
        rowId,
      ]),
    ),
    'a row cannot be moved to another school',
  ).rejects.toThrow(/row-level security/);
}
