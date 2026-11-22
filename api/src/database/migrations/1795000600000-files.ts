import type { MigrationInterface, QueryRunner } from 'typeorm';
import { enableTenantIsolation } from '../rls.js';

const TIMESTAMPS = `
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1`;

/** Stored files and where they are used: class drives, student files, submissions, attachments. */
export class Files1795000600000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const tables: [string, string][] = [
      [
        'files',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         name text NOT NULL,
         content_type text NOT NULL,
         size_bytes bigint NOT NULL CHECK (size_bytes > 0),
         status text NOT NULL CHECK (status IN ('pending', 'scanning', 'available', 'rejected')),
         purpose text NOT NULL CHECK (purpose IN ('drive', 'student', 'submission')),
         storage_key text NOT NULL,
         uploaded_by uuid REFERENCES users (id) ON DELETE SET NULL,
         scanned_at timestamptz,
         ${TIMESTAMPS}`,
      ],
      [
        'file_quotas',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL UNIQUE,
         quota_bytes bigint NOT NULL CHECK (quota_bytes >= 0),
         ${TIMESTAMPS}`,
      ],
      [
        'drive_items',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         class_id uuid NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
         parent_id uuid REFERENCES drive_items (id) ON DELETE CASCADE,
         kind text NOT NULL CHECK (kind IN ('folder', 'file')),
         name text NOT NULL,
         file_id uuid REFERENCES files (id) ON DELETE CASCADE,
         visibility text[] NOT NULL DEFAULT '{}'
           CHECK (visibility <@ ARRAY['class_member', 'student', 'guardian']::text[]),
         created_by uuid REFERENCES users (id) ON DELETE SET NULL,
         updated_by uuid REFERENCES users (id) ON DELETE SET NULL,
         ${TIMESTAMPS},
         CHECK ((kind = 'file') = (file_id IS NOT NULL))`,
      ],
      [
        'student_files',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         student_id uuid NOT NULL REFERENCES students (id) ON DELETE CASCADE,
         file_id uuid NOT NULL REFERENCES files (id) ON DELETE CASCADE,
         title text NOT NULL,
         visible_to_family boolean NOT NULL DEFAULT false,
         ${TIMESTAMPS}`,
      ],
      [
        'attachment_links',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         drive_item_id uuid NOT NULL REFERENCES drive_items (id) ON DELETE CASCADE,
         target_type text NOT NULL CHECK (target_type IN ('lesson', 'assessment', 'announcement')),
         target_id uuid NOT NULL,
         ${TIMESTAMPS},
         UNIQUE (drive_item_id, target_type, target_id)`,
      ],
    ];
    for (const [table, columns] of tables) {
      await queryRunner.query(`CREATE TABLE ${table} (${columns})`);
      await enableTenantIsolation(queryRunner, table);
    }
    await queryRunner.query(
      `CREATE INDEX drive_items_folder_idx ON drive_items (school_id, class_id, parent_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX attachment_links_target_idx ON attachment_links (school_id, target_type, target_id)`,
    );
    await queryRunner.query(
      `ALTER TABLE submissions ALTER COLUMN body DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE submissions ADD COLUMN file_id uuid REFERENCES files (id) ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE submissions ADD CONSTRAINT submissions_has_work CHECK (body IS NOT NULL OR file_id IS NOT NULL)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE submissions DROP CONSTRAINT submissions_has_work`,
    );
    await queryRunner.query(`ALTER TABLE submissions DROP COLUMN file_id`);
    await queryRunner.query(`DELETE FROM submissions WHERE body IS NULL`);
    await queryRunner.query(
      `ALTER TABLE submissions ALTER COLUMN body SET NOT NULL`,
    );
    for (const table of [
      'attachment_links',
      'student_files',
      'drive_items',
      'file_quotas',
      'files',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${table}`);
    }
  }
}
