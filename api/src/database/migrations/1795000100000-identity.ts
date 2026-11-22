import type { MigrationInterface, QueryRunner } from 'typeorm';
import { enableTenantIsolation } from '../rls.js';
import { runtimeRole } from '../runtime-role.js';

/**
 * Better Auth's tables (users, sessions, accounts, verifications, organizations,
 * members, invitations) with Darsi's names, plus school settings, in-app
 * notifications and the sign-in log. Auth tables span schools, so they are
 * global; every query on them is scoped by the guards.
 */
export class Identity1795000100000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const { identifier: role } = runtimeRole();

    await queryRunner.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY,
        name text NOT NULL,
        email text NOT NULL UNIQUE,
        email_verified boolean NOT NULL DEFAULT false,
        image text,
        locale text DEFAULT 'en',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE sessions (
        id uuid PRIMARY KEY,
        token text NOT NULL UNIQUE,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        active_organization_id uuid,
        expires_at timestamptz NOT NULL,
        ip_address text,
        user_agent text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX sessions_user_id_idx ON sessions (user_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE accounts (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        account_id text NOT NULL,
        provider_id text NOT NULL,
        access_token text,
        refresh_token text,
        id_token text,
        access_token_expires_at timestamptz,
        refresh_token_expires_at timestamptz,
        scope text,
        password text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (provider_id, account_id)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX accounts_user_id_idx ON accounts (user_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE verifications (
        id uuid PRIMARY KEY,
        identifier text NOT NULL,
        value text NOT NULL,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX verifications_identifier_idx ON verifications (identifier)`,
    );

    await queryRunner.query(`
      CREATE TABLE organizations (
        id uuid PRIMARY KEY,
        name text NOT NULL,
        slug text NOT NULL UNIQUE,
        logo text,
        metadata text,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE members (
        id uuid PRIMARY KEY,
        organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        role text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (organization_id, user_id)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX members_user_id_idx ON members (user_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE invitations (
        id uuid PRIMARY KEY,
        organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
        email text NOT NULL,
        role text,
        status text NOT NULL DEFAULT 'pending',
        expires_at timestamptz NOT NULL,
        inviter_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX invitations_organization_id_idx ON invitations (organization_id, status)`,
    );
    await queryRunner.query(
      `CREATE INDEX invitations_email_idx ON invitations (email)`,
    );

    await queryRunner.query(`
      CREATE TABLE schools (
        school_id uuid PRIMARY KEY REFERENCES organizations (id) ON DELETE CASCADE,
        default_locale text NOT NULL DEFAULT 'en' CHECK (default_locale IN ('en', 'fr')),
        time_zone text NOT NULL,
        currency char(3) NOT NULL,
        hosting_region text NOT NULL DEFAULT 'eu',
        onboarding_completed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version integer NOT NULL DEFAULT 1
      )
    `);
    await enableTenantIsolation(queryRunner, 'schools');

    await queryRunner.query(`
      CREATE TABLE notifications (
        id uuid PRIMARY KEY,
        school_id uuid NOT NULL,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        type text NOT NULL,
        params jsonb NOT NULL DEFAULT '{}',
        link text,
        read_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await enableTenantIsolation(queryRunner, 'notifications');
    await queryRunner.query(
      `CREATE INDEX notifications_inbox_idx ON notifications (school_id, user_id, id DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX notifications_unread_idx ON notifications (school_id, user_id) WHERE read_at IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE sign_in_events (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        ip_address text,
        user_agent text,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX sign_in_events_user_id_idx ON sign_in_events (user_id, created_at)`,
    );
    await queryRunner.query(
      `REVOKE UPDATE, DELETE, TRUNCATE ON sign_in_events FROM ${role}`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'sign_in_events',
      'notifications',
      'schools',
      'invitations',
      'members',
      'organizations',
      'verifications',
      'accounts',
      'sessions',
      'users',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${table}`);
    }
  }
}
