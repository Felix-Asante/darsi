import type { MigrationInterface, QueryRunner } from 'typeorm';
import { enableTenantIsolation } from '../rls.js';

const TIMESTAMPS = `
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1`;

/** Terms, calendar events, bell schedules with their periods, and class timetable slots. */
export class CalendarTimetables1795000300000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const tables: [string, string][] = [
      [
        'terms',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         academic_year_id uuid NOT NULL REFERENCES academic_years (id) ON DELETE CASCADE,
         name text NOT NULL,
         starts_on date NOT NULL,
         ends_on date NOT NULL,
         ${TIMESTAMPS},
         UNIQUE (academic_year_id, name),
         CHECK (ends_on >= starts_on)`,
      ],
      [
        'calendar_events',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         title text NOT NULL,
         description text,
         kind text NOT NULL CHECK (kind IN ('holiday', 'closure', 'exam', 'event')),
         starts_on date NOT NULL,
         ends_on date NOT NULL,
         start_time time,
         end_time time,
         recurrence text,
         audience text NOT NULL CHECK (audience IN ('school', 'division', 'grade_level', 'class')),
         audience_id uuid,
         created_by uuid REFERENCES users (id) ON DELETE SET NULL,
         ${TIMESTAMPS},
         CHECK (ends_on >= starts_on),
         CHECK ((audience = 'school') = (audience_id IS NULL)),
         CHECK ((start_time IS NULL) = (end_time IS NULL) AND (start_time IS NULL OR end_time > start_time))`,
      ],
      [
        'bell_schedules',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         division_id uuid REFERENCES divisions (id) ON DELETE CASCADE,
         name text NOT NULL,
         rotation_kind text NOT NULL CHECK (rotation_kind IN ('weekly', 'cycle')),
         rotation_length integer NOT NULL CHECK (rotation_length BETWEEN 1 AND 20),
         weekdays smallint[] NOT NULL DEFAULT '{1,2,3,4,5}',
         ${TIMESTAMPS},
         UNIQUE NULLS NOT DISTINCT (school_id, division_id)`,
      ],
      [
        'bell_periods',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         bell_schedule_id uuid NOT NULL REFERENCES bell_schedules (id) ON DELETE CASCADE,
         name text NOT NULL,
         starts_at time NOT NULL,
         ends_at time NOT NULL,
         sort_order integer NOT NULL DEFAULT 0,
         ${TIMESTAMPS},
         UNIQUE (bell_schedule_id, name),
         CHECK (ends_at > starts_at)`,
      ],
      [
        'timetable_slots',
        `id uuid PRIMARY KEY,
         school_id uuid NOT NULL,
         class_id uuid NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
         period_id uuid NOT NULL REFERENCES bell_periods (id) ON DELETE CASCADE,
         cycle_day integer NOT NULL CHECK (cycle_day >= 1),
         room text,
         teacher_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
         ${TIMESTAMPS},
         UNIQUE (class_id, period_id, cycle_day)`,
      ],
    ];

    for (const [table, columns] of tables) {
      await queryRunner.query(`CREATE TABLE ${table} (${columns})`);
      await enableTenantIsolation(queryRunner, table);
    }
    await queryRunner.query(
      `ALTER TABLE import_jobs DROP CONSTRAINT import_jobs_kind_check`,
    );
    await queryRunner.query(
      `ALTER TABLE import_jobs ADD CONSTRAINT import_jobs_kind_check
         CHECK (kind IN ('students', 'guardians', 'classes', 'enrolments', 'standards', 'timetable'))`,
    );
    await queryRunner.query(
      `CREATE INDEX calendar_events_dates_idx ON calendar_events (school_id, starts_on)`,
    );
    await queryRunner.query(
      `CREATE INDEX timetable_slots_class_idx ON timetable_slots (school_id, class_id)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM import_jobs WHERE kind = 'timetable'`);
    await queryRunner.query(
      `ALTER TABLE import_jobs DROP CONSTRAINT import_jobs_kind_check`,
    );
    await queryRunner.query(
      `ALTER TABLE import_jobs ADD CONSTRAINT import_jobs_kind_check
         CHECK (kind IN ('students', 'guardians', 'classes', 'enrolments', 'standards'))`,
    );
    for (const table of [
      'timetable_slots',
      'bell_periods',
      'bell_schedules',
      'calendar_events',
      'terms',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${table}`);
    }
  }
}
