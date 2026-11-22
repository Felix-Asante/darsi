import type { MigrationInterface, QueryRunner } from 'typeorm';
import { enableTenantIsolation } from '../rls.js';

const TIMESTAMPS = `
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1`;

/** Student and class portfolios, and progress report templates, cards and entries. */
export class PortfolioReports1795000700000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE files DROP CONSTRAINT files_purpose_check`,
    );
    await queryRunner.query(
      `ALTER TABLE files ADD CONSTRAINT files_purpose_check
         CHECK (purpose IN ('drive', 'student', 'submission', 'portfolio'))`,
    );
    const tables: [string, string][] = [
      [
        'portfolio_settings',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL UNIQUE,
         approval_required boolean NOT NULL DEFAULT true,
         ${TIMESTAMPS}`,
      ],
      [
        'portfolio_items',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         student_id uuid REFERENCES students (id) ON DELETE CASCADE,
         class_id uuid REFERENCES classes (id) ON DELETE CASCADE,
         kind text NOT NULL CHECK (kind IN ('image', 'document', 'link', 'text')),
         title text NOT NULL,
         description text,
         url text,
         body jsonb,
         file_id uuid REFERENCES files (id) ON DELETE SET NULL,
         tags text[] NOT NULL DEFAULT '{}',
         added_by uuid REFERENCES users (id) ON DELETE SET NULL,
         status text NOT NULL CHECK (status IN ('pending', 'approved')),
         approved_by uuid REFERENCES users (id) ON DELETE SET NULL,
         ${TIMESTAMPS},
         CHECK (student_id IS NOT NULL OR class_id IS NOT NULL)`,
      ],
      [
        'portfolio_comments',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         item_id uuid NOT NULL REFERENCES portfolio_items (id) ON DELETE CASCADE,
         author_id uuid REFERENCES users (id) ON DELETE SET NULL,
         kind text NOT NULL CHECK (kind IN ('comment', 'reflection')),
         body text NOT NULL,
         ${TIMESTAMPS}`,
      ],
      [
        'report_templates',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         division_id uuid REFERENCES divisions (id) ON DELETE CASCADE,
         name text NOT NULL,
         subject_ids uuid[] NOT NULL DEFAULT '{}',
         include_attendance boolean NOT NULL DEFAULT true,
         include_general_comment boolean NOT NULL DEFAULT true,
         ${TIMESTAMPS},
         UNIQUE NULLS NOT DISTINCT (school_id, division_id)`,
      ],
      [
        'report_cards',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         term_id uuid NOT NULL REFERENCES terms (id) ON DELETE CASCADE,
         student_id uuid NOT NULL REFERENCES students (id) ON DELETE CASCADE,
         template_id uuid REFERENCES report_templates (id) ON DELETE SET NULL,
         status text NOT NULL CHECK (status IN ('draft', 'returned', 'approved', 'published')),
         general_comment text,
         return_note text,
         attendance jsonb,
         locale text NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'fr')),
         file_id uuid REFERENCES files (id) ON DELETE SET NULL,
         approved_by uuid REFERENCES users (id) ON DELETE SET NULL,
         approved_at timestamptz,
         published_at timestamptz,
         ${TIMESTAMPS},
         UNIQUE (term_id, student_id)`,
      ],
      [
        'report_entries',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         card_id uuid NOT NULL REFERENCES report_cards (id) ON DELETE CASCADE,
         class_id uuid NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
         subject_name text,
         result_value text,
         reporting_scale_name text,
         comment text,
         comment_by uuid REFERENCES users (id) ON DELETE SET NULL,
         ${TIMESTAMPS},
         UNIQUE (card_id, class_id)`,
      ],
    ];
    for (const [table, columns] of tables) {
      await queryRunner.query(`CREATE TABLE ${table} (${columns})`);
      await enableTenantIsolation(queryRunner, table);
    }
    await queryRunner.query(
      `CREATE INDEX portfolio_items_student_idx ON portfolio_items (school_id, student_id, created_at DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX portfolio_items_class_idx ON portfolio_items (school_id, class_id, created_at DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX report_entries_class_idx ON report_entries (school_id, class_id)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'report_entries',
      'report_cards',
      'report_templates',
      'portfolio_comments',
      'portfolio_items',
      'portfolio_settings',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${table}`);
    }
    await queryRunner.query(`DELETE FROM files WHERE purpose = 'portfolio'`);
    await queryRunner.query(
      `ALTER TABLE files DROP CONSTRAINT files_purpose_check`,
    );
    await queryRunner.query(
      `ALTER TABLE files ADD CONSTRAINT files_purpose_check CHECK (purpose IN ('drive', 'student', 'submission'))`,
    );
  }
}
