import type { MigrationInterface, QueryRunner } from 'typeorm';
import { enableTenantIsolation } from '../rls.js';

const TIMESTAMPS = `
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1`;

const SCALE_KINDS = `'points', 'percentage', 'letter', 'levels', 'standards', 'pass_fail', 'custom'`;

/**
 * Grading scales with immutable versions, conversion tables, per-subject
 * grading policies and categories, assessments with rubrics and standards,
 * grades and submissions.
 */
export class Assessment1795000400000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const tables: [string, string][] = [
      [
        'grading_scales',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         name text NOT NULL,
         kind text NOT NULL CHECK (kind IN (${SCALE_KINDS})),
         current_version integer NOT NULL DEFAULT 1,
         ${TIMESTAMPS},
         UNIQUE (school_id, name)`,
      ],
      [
        'grading_scale_versions',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         scale_id uuid NOT NULL REFERENCES grading_scales (id) ON DELETE CASCADE,
         scale_version integer NOT NULL,
         definition jsonb NOT NULL,
         ${TIMESTAMPS},
         UNIQUE (scale_id, scale_version)`,
      ],
      [
        'scale_conversions',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         from_scale_id uuid NOT NULL REFERENCES grading_scales (id) ON DELETE CASCADE,
         to_scale_id uuid NOT NULL REFERENCES grading_scales (id) ON DELETE CASCADE,
         mapping jsonb NOT NULL,
         effective_from timestamptz NOT NULL DEFAULT now(),
         created_by uuid REFERENCES users (id) ON DELETE SET NULL,
         ${TIMESTAMPS},
         CHECK (from_scale_id <> to_scale_id)`,
      ],
      [
        'grading_policies',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         subject_id uuid REFERENCES subjects (id) ON DELETE CASCADE,
         reporting_scale_id uuid REFERENCES grading_scales (id) ON DELETE SET NULL,
         method text NOT NULL CHECK (method IN ('weighted_average', 'most_recent', 'highest', 'mode')),
         ${TIMESTAMPS},
         UNIQUE NULLS NOT DISTINCT (school_id, subject_id)`,
      ],
      [
        'assessment_categories',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         policy_id uuid NOT NULL REFERENCES grading_policies (id) ON DELETE CASCADE,
         name text NOT NULL,
         weight integer NOT NULL CHECK (weight BETWEEN 0 AND 1000),
         ${TIMESTAMPS},
         UNIQUE (policy_id, name)`,
      ],
      [
        'assessments',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         class_id uuid NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
         title text NOT NULL,
         description text,
         kind text NOT NULL CHECK (kind IN ('formative', 'summative')),
         due_on date,
         scale_id uuid NOT NULL REFERENCES grading_scales (id) ON DELETE RESTRICT,
         scale_version integer NOT NULL,
         category_id uuid REFERENCES assessment_categories (id) ON DELETE SET NULL,
         weight double precision NOT NULL DEFAULT 1 CHECK (weight >= 0),
         created_by uuid REFERENCES users (id) ON DELETE SET NULL,
         ${TIMESTAMPS}`,
      ],
      [
        'assessment_criteria',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         assessment_id uuid NOT NULL REFERENCES assessments (id) ON DELETE CASCADE,
         name text NOT NULL,
         scale_id uuid NOT NULL REFERENCES grading_scales (id) ON DELETE RESTRICT,
         scale_version integer NOT NULL,
         weight double precision NOT NULL DEFAULT 1 CHECK (weight >= 0),
         sort_order integer NOT NULL DEFAULT 0,
         ${TIMESTAMPS}`,
      ],
      [
        'assessment_standards',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         assessment_id uuid NOT NULL REFERENCES assessments (id) ON DELETE CASCADE,
         standard_id uuid NOT NULL REFERENCES standards (id) ON DELETE CASCADE,
         ${TIMESTAMPS},
         UNIQUE (assessment_id, standard_id)`,
      ],
      [
        'grades',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         assessment_id uuid NOT NULL REFERENCES assessments (id) ON DELETE CASCADE,
         student_id uuid NOT NULL REFERENCES students (id) ON DELETE CASCADE,
         value text,
         mastery double precision CHECK (mastery BETWEEN 0 AND 1),
         criterion_values jsonb NOT NULL DEFAULT '{}',
         comment text,
         excused boolean NOT NULL DEFAULT false,
         status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
         entered_by uuid REFERENCES users (id) ON DELETE SET NULL,
         published_at timestamptz,
         published_by uuid REFERENCES users (id) ON DELETE SET NULL,
         ${TIMESTAMPS},
         UNIQUE (assessment_id, student_id)`,
      ],
      [
        'submissions',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         assessment_id uuid NOT NULL REFERENCES assessments (id) ON DELETE CASCADE,
         student_id uuid NOT NULL REFERENCES students (id) ON DELETE CASCADE,
         body text NOT NULL,
         submitted_at timestamptz NOT NULL DEFAULT now(),
         is_late boolean NOT NULL DEFAULT false,
         ${TIMESTAMPS},
         UNIQUE (assessment_id, student_id)`,
      ],
    ];

    for (const [table, columns] of tables) {
      await queryRunner.query(`CREATE TABLE ${table} (${columns})`);
      await enableTenantIsolation(queryRunner, table);
    }
    await queryRunner.query(
      `CREATE INDEX assessments_class_idx ON assessments (school_id, class_id, due_on)`,
    );
    await queryRunner.query(
      `CREATE INDEX grades_student_idx ON grades (school_id, student_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX scale_conversions_lookup_idx ON scale_conversions (school_id, from_scale_id, to_scale_id, effective_from)`,
    );
    // A scale version is a record of how past grades were given: it never changes.
    await queryRunner.query(
      `CREATE FUNCTION reject_scale_version_change() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN
         RAISE EXCEPTION 'grading scale versions are immutable' USING ERRCODE = 'check_violation';
       END $$`,
    );
    await queryRunner.query(
      `CREATE TRIGGER grading_scale_versions_immutable BEFORE UPDATE ON grading_scale_versions
         FOR EACH ROW EXECUTE FUNCTION reject_scale_version_change()`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'submissions',
      'grades',
      'assessment_standards',
      'assessment_criteria',
      'assessments',
      'assessment_categories',
      'grading_policies',
      'scale_conversions',
      'grading_scale_versions',
      'grading_scales',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${table}`);
    }
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS reject_scale_version_change()`,
    );
  }
}
