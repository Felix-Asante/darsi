import type { MigrationInterface, QueryRunner } from 'typeorm';
import { enableTenantIsolation } from '../rls.js';

const TIMESTAMPS = `
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1`;

/** Admission cycles, forms, pipeline stages, applications, staff notes and re-enrolment. */
export class Admissions1795000900000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const tables: [string, string][] = [
      [
        'admission_cycles',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         academic_year_id uuid NOT NULL REFERENCES academic_years (id) ON DELETE CASCADE,
         name text NOT NULL,
         opens_on date NOT NULL,
         closes_on date NOT NULL CHECK (closes_on >= opens_on),
         grades jsonb NOT NULL DEFAULT '[]',
         application_fee bigint NOT NULL DEFAULT 0 CHECK (application_fee >= 0),
         deposit_fee_item_id uuid REFERENCES fee_items (id) ON DELETE SET NULL,
         ${TIMESTAMPS},
         UNIQUE (school_id, name)`,
      ],
      [
        'admission_forms',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         division_id uuid REFERENCES divisions (id) ON DELETE CASCADE,
         fields jsonb NOT NULL DEFAULT '[]',
         documents jsonb NOT NULL DEFAULT '[]',
         ${TIMESTAMPS},
         UNIQUE NULLS NOT DISTINCT (school_id, division_id)`,
      ],
      [
        'admission_stages',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         name text NOT NULL,
         kind text NOT NULL CHECK (kind IN ('enquiry', 'submitted', 'review', 'interview', 'offered', 'accepted', 'enrolled', 'waitlisted', 'declined', 'withdrawn')),
         sort_order integer NOT NULL,
         email jsonb,
         ${TIMESTAMPS},
         UNIQUE (school_id, name)`,
      ],
      [
        'applications',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         cycle_id uuid NOT NULL REFERENCES admission_cycles (id) ON DELETE RESTRICT,
         grade_level_id uuid NOT NULL REFERENCES grade_levels (id) ON DELETE RESTRICT,
         applicant_user_id uuid NOT NULL,
         status text NOT NULL CHECK (status IN ('draft', 'submitted')),
         stage_id uuid REFERENCES admission_stages (id) ON DELETE RESTRICT,
         student_first_name text,
         student_last_name text,
         student_preferred_name text,
         student_date_of_birth date,
         guardian_first_name text,
         guardian_last_name text,
         guardian_email text NOT NULL,
         guardian_phone text,
         guardian_relationship text,
         locale text NOT NULL DEFAULT 'en',
         answers jsonb NOT NULL DEFAULT '{}',
         submitted_at timestamptz,
         family_id uuid REFERENCES families (id) ON DELETE SET NULL,
         fee_invoice_id uuid,
         offer_expires_on date,
         offer_response text CHECK (offer_response IN ('accepted', 'declined')),
         responded_at timestamptz,
         student_id uuid REFERENCES students (id) ON DELETE SET NULL,
         ${TIMESTAMPS}`,
      ],
      [
        'application_documents',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         application_id uuid NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
         key text NOT NULL,
         file_id uuid NOT NULL REFERENCES files (id) ON DELETE CASCADE,
         ${TIMESTAMPS},
         UNIQUE (application_id, key)`,
      ],
      [
        'application_notes',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         application_id uuid NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
         author_id uuid NOT NULL,
         kind text NOT NULL CHECK (kind IN ('note', 'rating', 'interview')),
         body text NOT NULL,
         rating integer CHECK (rating BETWEEN 1 AND 5),
         ${TIMESTAMPS}`,
      ],
      [
        're_enrolments',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         student_id uuid NOT NULL REFERENCES students (id) ON DELETE CASCADE,
         academic_year_id uuid NOT NULL REFERENCES academic_years (id) ON DELETE CASCADE,
         grade_level_id uuid REFERENCES grade_levels (id) ON DELETE SET NULL,
         status text NOT NULL CHECK (status IN ('pending', 'confirmed', 'declined', 'applied')),
         responded_by uuid,
         responded_at timestamptz,
         ${TIMESTAMPS},
         UNIQUE (student_id, academic_year_id)`,
      ],
    ];
    for (const [table, columns] of tables) {
      await queryRunner.query(`CREATE TABLE ${table} (${columns})`);
      await enableTenantIsolation(queryRunner, table);
    }
    await queryRunner.query(
      `CREATE INDEX applications_cycle_idx ON applications (cycle_id, stage_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX applications_applicant_idx ON applications (applicant_user_id)`,
    );
    // One student per application, however often enrolment is retried (ADMS-11).
    await queryRunner.query(
      `CREATE UNIQUE INDEX applications_student_idx ON applications (student_id) WHERE student_id IS NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE files DROP CONSTRAINT files_purpose_check`,
    );
    await queryRunner.query(
      `ALTER TABLE files ADD CONSTRAINT files_purpose_check
         CHECK (purpose IN ('drive', 'student', 'submission', 'portfolio', 'application'))`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM files WHERE purpose = 'application'`);
    await queryRunner.query(
      `ALTER TABLE files DROP CONSTRAINT files_purpose_check`,
    );
    await queryRunner.query(
      `ALTER TABLE files ADD CONSTRAINT files_purpose_check CHECK (purpose IN ('drive', 'student', 'submission', 'portfolio'))`,
    );
    for (const table of [
      're_enrolments',
      'application_notes',
      'application_documents',
      'applications',
      'admission_stages',
      'admission_forms',
      'admission_cycles',
    ]) {
      await queryRunner.query(`DROP TABLE ${table}`);
    }
  }
}
