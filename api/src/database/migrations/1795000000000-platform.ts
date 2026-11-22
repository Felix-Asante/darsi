import { PostgresOutboxStore } from '@nestjs/outbox/postgres';
import { escapeLiteral } from 'pg';
import type { MigrationInterface, QueryRunner } from 'typeorm';
import { enableTenantIsolation } from '../rls.js';
import { runtimeRole } from '../runtime-role.js';

export class Platform1795000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const { name, identifier: role, password } = runtimeRole();
    const [{ exists }] = await queryRunner.query(
      `SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS exists`,
      [name],
    );
    await queryRunner.query(
      exists
        ? `ALTER ROLE ${role} LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD ${escapeLiteral(password)}`
        : `CREATE ROLE ${role} LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD ${escapeLiteral(password)}`,
    );

    await queryRunner.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
    await queryRunner.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`,
    );
    await queryRunner.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${role}`,
    );

    await queryRunner.query(`
      CREATE FUNCTION app_current_school_id() RETURNS uuid
      LANGUAGE sql STABLE
      AS $$ SELECT nullif(current_setting('app.school_id', true), '')::uuid $$
    `);

    await queryRunner.query(`
      CREATE TABLE audit_events (
        id uuid PRIMARY KEY,
        school_id uuid NOT NULL,
        actor_id uuid,
        action text NOT NULL,
        entity_type text NOT NULL,
        entity_id text,
        diff jsonb,
        request_id text,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await enableTenantIsolation(queryRunner, 'audit_events');
    await queryRunner.query(
      `CREATE INDEX audit_events_entity_idx ON audit_events (school_id, entity_type, entity_id, created_at)`,
    );
    await queryRunner.query(
      `REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM ${role}`,
    );
    await queryRunner.query(`
      CREATE FUNCTION reject_audit_change() RETURNS trigger
      LANGUAGE plpgsql
      AS $$ BEGIN RAISE EXCEPTION 'audit_events is append-only'; END $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER audit_events_append_only
      BEFORE UPDATE OR DELETE ON audit_events
      FOR EACH ROW EXECUTE FUNCTION reject_audit_change()
    `);

    await queryRunner.query(PostgresOutboxStore.migrationSql());
    await queryRunner.query(`GRANT USAGE ON SCHEMA nest_outbox TO ${role}`);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA nest_outbox TO ${role}`,
    );
    await queryRunner.query(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA nest_outbox TO ${role}`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SCHEMA IF EXISTS nest_outbox CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit_events`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS reject_audit_change()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS app_current_school_id()`);
  }
}
