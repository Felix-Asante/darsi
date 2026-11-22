import type { MigrationInterface, QueryRunner } from 'typeorm';
import { enableTenantIsolation } from '../rls.js';

const TIMESTAMPS = `
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1`;

/** Notification preferences, attendance, announcements, and unit and lesson plans. */
export class DailyTeaching1795000500000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const tables: [string, string][] = [
      [
        'notification_preferences',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
         type text NOT NULL,
         in_app boolean NOT NULL,
         email boolean NOT NULL,
         ${TIMESTAMPS},
         UNIQUE (school_id, user_id, type)`,
      ],
      [
        'attendance_settings',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL UNIQUE,
         mode text NOT NULL DEFAULT 'daily' CHECK (mode IN ('daily', 'period')),
         notify_after_minutes integer NOT NULL DEFAULT 60 CHECK (notify_after_minutes BETWEEN 0 AND 1440),
         ${TIMESTAMPS}`,
      ],
      [
        'attendance_statuses',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         code text NOT NULL,
         label text NOT NULL,
         counts_as text NOT NULL CHECK (counts_as IN ('present', 'absent', 'late', 'excused')),
         sort_order integer NOT NULL DEFAULT 0,
         ${TIMESTAMPS},
         UNIQUE (school_id, code)`,
      ],
      [
        'attendance_sessions',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         class_id uuid NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
         date date NOT NULL,
         period_id uuid REFERENCES bell_periods (id) ON DELETE SET NULL,
         taken_by uuid REFERENCES users (id) ON DELETE SET NULL,
         taken_at timestamptz NOT NULL DEFAULT now(),
         ${TIMESTAMPS},
         UNIQUE NULLS NOT DISTINCT (class_id, date, period_id)`,
      ],
      [
        'attendance_records',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         session_id uuid NOT NULL REFERENCES attendance_sessions (id) ON DELETE CASCADE,
         student_id uuid NOT NULL REFERENCES students (id) ON DELETE CASCADE,
         status text NOT NULL,
         reason text,
         reason_source text CHECK (reason_source IN ('staff', 'guardian')),
         notified_at timestamptz,
         ${TIMESTAMPS},
         UNIQUE (session_id, student_id)`,
      ],
      [
        'absence_notes',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         student_id uuid NOT NULL REFERENCES students (id) ON DELETE CASCADE,
         date date NOT NULL,
         reason text NOT NULL,
         submitted_by uuid REFERENCES users (id) ON DELETE SET NULL,
         ${TIMESTAMPS},
         UNIQUE (student_id, date)`,
      ],
      [
        'announcements',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         title text NOT NULL,
         body jsonb NOT NULL,
         audience text NOT NULL CHECK (audience IN ('school', 'division', 'grade_level', 'class', 'role')),
         audience_id uuid,
         audience_role text,
         author_id uuid REFERENCES users (id) ON DELETE SET NULL,
         publish_at timestamptz NOT NULL,
         published_at timestamptz,
         ${TIMESTAMPS},
         CHECK ((audience IN ('school', 'role')) = (audience_id IS NULL)),
         CHECK ((audience = 'role') = (audience_role IS NOT NULL))`,
      ],
      [
        'class_announcement_settings',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         class_id uuid NOT NULL UNIQUE REFERENCES classes (id) ON DELETE CASCADE,
         assistants_can_post boolean NOT NULL DEFAULT false,
         ${TIMESTAMPS}`,
      ],
      [
        'plan_templates',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         name text NOT NULL,
         framework_id uuid REFERENCES frameworks (id) ON DELETE SET NULL,
         fields jsonb NOT NULL DEFAULT '[]',
         ${TIMESTAMPS},
         UNIQUE (school_id, name)`,
      ],
      [
        'units',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         template_id uuid REFERENCES plan_templates (id) ON DELETE SET NULL,
         title text NOT NULL,
         starts_on date,
         ends_on date,
         objectives jsonb,
         field_values jsonb NOT NULL DEFAULT '{}',
         created_by uuid REFERENCES users (id) ON DELETE SET NULL,
         updated_by uuid REFERENCES users (id) ON DELETE SET NULL,
         ${TIMESTAMPS},
         CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)`,
      ],
      [
        'unit_classes',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         unit_id uuid NOT NULL REFERENCES units (id) ON DELETE CASCADE,
         class_id uuid NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
         ${TIMESTAMPS},
         UNIQUE (unit_id, class_id)`,
      ],
      [
        'unit_standards',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         unit_id uuid NOT NULL REFERENCES units (id) ON DELETE CASCADE,
         standard_id uuid NOT NULL REFERENCES standards (id) ON DELETE CASCADE,
         ${TIMESTAMPS},
         UNIQUE (unit_id, standard_id)`,
      ],
      [
        'unit_collaborators',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         unit_id uuid NOT NULL REFERENCES units (id) ON DELETE CASCADE,
         user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
         role text NOT NULL CHECK (role IN ('editor', 'viewer')),
         ${TIMESTAMPS},
         UNIQUE (unit_id, user_id)`,
      ],
      [
        'unit_assessments',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         unit_id uuid NOT NULL REFERENCES units (id) ON DELETE CASCADE,
         assessment_id uuid NOT NULL REFERENCES assessments (id) ON DELETE CASCADE,
         ${TIMESTAMPS},
         UNIQUE (unit_id, assessment_id)`,
      ],
      [
        'lessons',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         unit_id uuid NOT NULL REFERENCES units (id) ON DELETE CASCADE,
         title text NOT NULL,
         date date,
         objectives jsonb,
         activities jsonb,
         resources jsonb,
         sort_order integer NOT NULL DEFAULT 0,
         updated_by uuid REFERENCES users (id) ON DELETE SET NULL,
         ${TIMESTAMPS}`,
      ],
    ];

    for (const [table, columns] of tables) {
      await queryRunner.query(`CREATE TABLE ${table} (${columns})`);
      await enableTenantIsolation(queryRunner, table);
    }
    await queryRunner.query(
      `CREATE INDEX attendance_sessions_date_idx ON attendance_sessions (school_id, date)`,
    );
    await queryRunner.query(
      `CREATE INDEX attendance_records_student_idx ON attendance_records (school_id, student_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX announcements_feed_idx ON announcements (school_id, published_at DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX announcements_due_idx ON announcements (publish_at) WHERE published_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX lessons_unit_idx ON lessons (school_id, unit_id, sort_order)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'lessons',
      'unit_assessments',
      'unit_collaborators',
      'unit_standards',
      'unit_classes',
      'units',
      'plan_templates',
      'class_announcement_settings',
      'announcements',
      'absence_notes',
      'attendance_records',
      'attendance_sessions',
      'attendance_statuses',
      'attendance_settings',
      'notification_preferences',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${table}`);
    }
  }
}
