import type { QueryRunner } from 'typeorm';

/**
 * Every tenant table goes through this in its migration: rows default to the
 * current school, and reads and writes outside it are impossible for the
 * runtime role even if application code forgets a filter.
 */
export async function enableTenantIsolation(
  queryRunner: QueryRunner,
  table: string,
): Promise<void> {
  await queryRunner.query(
    `ALTER TABLE "${table}" ALTER COLUMN "school_id" SET DEFAULT app_current_school_id()`,
  );
  await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
  await queryRunner.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
  await queryRunner.query(
    `CREATE POLICY tenant_isolation ON "${table}"
       USING (school_id = app_current_school_id())
       WITH CHECK (school_id = app_current_school_id())`,
  );
  await queryRunner.query(
    `CREATE INDEX IF NOT EXISTS "${table}_school_id_idx" ON "${table}" (school_id)`,
  );
}
