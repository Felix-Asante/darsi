import type { MigrationInterface, QueryRunner } from 'typeorm';
import { enableTenantIsolation } from '../rls.js';

const TIMESTAMPS = `
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1`;

/**
 * The school's structure (years, divisions, grade levels, subjects, classes and
 * their staff), its people (students, guardians, families, enrolments), its
 * curriculum (frameworks and standards) and CSV import jobs.
 */
export class AcademicsPeople1795000200000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const tables: [string, string][] = [
      [
        'academic_years',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         name text NOT NULL,
         starts_on date NOT NULL,
         ends_on date NOT NULL,
         is_current boolean NOT NULL DEFAULT false,
         ${TIMESTAMPS},
         UNIQUE (school_id, name),
         CHECK (ends_on > starts_on)`,
      ],
      [
        'divisions',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         name text NOT NULL,
         sort_order integer NOT NULL DEFAULT 0,
         ${TIMESTAMPS},
         UNIQUE (school_id, name)`,
      ],
      [
        'grade_levels',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         division_id uuid NOT NULL REFERENCES divisions (id) ON DELETE RESTRICT,
         name text NOT NULL,
         sort_order integer NOT NULL DEFAULT 0,
         ${TIMESTAMPS},
         UNIQUE (school_id, name)`,
      ],
      [
        'subjects',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         code text NOT NULL,
         name text NOT NULL,
         ${TIMESTAMPS},
         UNIQUE (school_id, code)`,
      ],
      [
        'classes',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         academic_year_id uuid NOT NULL REFERENCES academic_years (id) ON DELETE RESTRICT,
         grade_level_id uuid REFERENCES grade_levels (id) ON DELETE SET NULL,
         subject_id uuid REFERENCES subjects (id) ON DELETE SET NULL,
         code text NOT NULL,
         name text NOT NULL,
         ${TIMESTAMPS},
         UNIQUE (school_id, academic_year_id, code)`,
      ],
      [
        'class_staff',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         class_id uuid NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
         user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
         role text NOT NULL CHECK (role IN ('teacher', 'teaching_assistant', 'class_member')),
         ${TIMESTAMPS},
         UNIQUE (class_id, user_id)`,
      ],
      [
        'families',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         name text NOT NULL,
         ${TIMESTAMPS}`,
      ],
      [
        'students',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         user_id uuid REFERENCES users (id) ON DELETE SET NULL,
         family_id uuid REFERENCES families (id) ON DELETE SET NULL,
         grade_level_id uuid REFERENCES grade_levels (id) ON DELETE SET NULL,
         student_number text NOT NULL,
         first_name text NOT NULL,
         last_name text NOT NULL,
         preferred_name text,
         date_of_birth date,
         email text,
         status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn')),
         enrolled_on date,
         withdrawn_on date,
         withdrawal_reason text,
         ${TIMESTAMPS},
         UNIQUE (school_id, student_number)`,
      ],
      [
        'guardians',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         user_id uuid REFERENCES users (id) ON DELETE SET NULL,
         family_id uuid REFERENCES families (id) ON DELETE SET NULL,
         first_name text NOT NULL,
         last_name text NOT NULL,
         email text NOT NULL,
         phone text,
         preferred_locale text NOT NULL DEFAULT 'en' CHECK (preferred_locale IN ('en', 'fr')),
         ${TIMESTAMPS},
         UNIQUE (school_id, email)`,
      ],
      [
        'guardian_links',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         guardian_id uuid NOT NULL REFERENCES guardians (id) ON DELETE CASCADE,
         student_id uuid NOT NULL REFERENCES students (id) ON DELETE CASCADE,
         relationship text NOT NULL DEFAULT 'guardian'
           CHECK (relationship IN ('mother', 'father', 'parent', 'guardian', 'grandparent', 'other')),
         is_primary_contact boolean NOT NULL DEFAULT false,
         ${TIMESTAMPS},
         UNIQUE (guardian_id, student_id)`,
      ],
      [
        'enrolments',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         student_id uuid NOT NULL REFERENCES students (id) ON DELETE CASCADE,
         class_id uuid NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
         starts_on date NOT NULL,
         ends_on date,
         ${TIMESTAMPS},
         CHECK (ends_on IS NULL OR ends_on >= starts_on)`,
      ],
      [
        'frameworks',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         code text NOT NULL,
         name text NOT NULL,
         description text,
         ${TIMESTAMPS},
         UNIQUE (school_id, code)`,
      ],
      [
        'standards',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         framework_id uuid NOT NULL REFERENCES frameworks (id) ON DELETE CASCADE,
         parent_id uuid REFERENCES standards (id) ON DELETE CASCADE,
         code text NOT NULL,
         description text NOT NULL,
         sort_order integer NOT NULL DEFAULT 0,
         ${TIMESTAMPS},
         UNIQUE (framework_id, code)`,
      ],
      [
        'import_jobs',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         kind text NOT NULL CHECK (kind IN ('students', 'guardians', 'classes', 'enrolments', 'standards')),
         status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
         file_name text NOT NULL,
         content text NOT NULL,
         total_rows integer NOT NULL DEFAULT 0,
         imported_rows integer NOT NULL DEFAULT 0,
         failed_rows integer NOT NULL DEFAULT 0,
         errors jsonb NOT NULL DEFAULT '[]',
         created_by uuid REFERENCES users (id) ON DELETE SET NULL,
         finished_at timestamptz,
         ${TIMESTAMPS}`,
      ],
    ];

    for (const [table, columns] of tables) {
      await queryRunner.query(`CREATE TABLE ${table} (${columns})`);
      await enableTenantIsolation(queryRunner, table);
    }

    await queryRunner.query(
      `CREATE UNIQUE INDEX academic_years_one_current ON academic_years (school_id) WHERE is_current`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX enrolments_one_open ON enrolments (student_id, class_id) WHERE ends_on IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX enrolments_class_idx ON enrolments (school_id, class_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX class_staff_user_idx ON class_staff (school_id, user_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX students_name_idx ON students (school_id, last_name, first_name)`,
    );
    await queryRunner.query(
      `CREATE INDEX guardian_links_student_idx ON guardian_links (school_id, student_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX standards_framework_idx ON standards (school_id, framework_id, sort_order)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'import_jobs',
      'standards',
      'frameworks',
      'enrolments',
      'guardian_links',
      'guardians',
      'students',
      'families',
      'class_staff',
      'classes',
      'subjects',
      'grade_levels',
      'divisions',
      'academic_years',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${table}`);
    }
  }
}
