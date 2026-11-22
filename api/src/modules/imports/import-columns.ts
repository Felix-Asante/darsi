import type { ImportKind } from './entities/import-job.entity.js';

/** The columns each import needs, and the ones it understands. Shown to users as the template. */
export const IMPORT_COLUMNS: Record<
  ImportKind,
  { required: string[]; optional: string[] }
> = {
  students: {
    required: ['student_number', 'first_name', 'last_name'],
    optional: ['preferred_name', 'date_of_birth', 'email', 'grade_level'],
  },
  guardians: {
    required: ['email', 'first_name', 'last_name'],
    optional: ['phone', 'preferred_locale', 'student_numbers', 'relationship'],
  },
  classes: {
    required: ['code', 'name'],
    optional: [
      'subject_code',
      'grade_level',
      'teacher_emails',
      'assistant_emails',
    ],
  },
  enrolments: {
    required: ['student_number', 'class_code'],
    optional: [],
  },
  standards: {
    required: ['framework_code', 'code', 'description'],
    optional: ['framework_name', 'parent_code'],
  },
  /** `day` is the rotation day: 1–5 for a weekly timetable, 6–10 for Week B, or the day of a cycle. */
  timetable: {
    required: ['class_code', 'day', 'period'],
    optional: ['room'],
  },
};
