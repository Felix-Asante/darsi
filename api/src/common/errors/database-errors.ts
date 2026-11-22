import { HttpStatus } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ProblemException } from './problem.exception.js';

interface PgError {
  code?: string;
  table?: string;
  constraint?: string;
}

const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

/**
 * Postgres hides the key's values (the error's `detail`) on tables with row-level
 * security, so the field comes from the constraint's default name instead:
 * `students_school_id_student_number_key` → `studentNumber`, the key's last column.
 */
function conflictingField(
  table: string | undefined,
  constraint: string | undefined,
): string | null {
  if (
    !table ||
    !constraint?.startsWith(`${table}_`) ||
    !constraint.endsWith('_key')
  )
    return null;
  const columns = constraint.slice(table.length + 1, -'_key'.length);
  const column = columns.split(/(?<=_id)_/).pop();
  return column
    ? column.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
    : null;
}

/** Turns constraint violations into answers the UI can explain, instead of a 500. */
export function toProblemFromDatabase(error: unknown): ProblemException | null {
  if (!(error instanceof QueryFailedError)) return null;
  const { code, table, constraint } = error.driverError as PgError;

  if (code === UNIQUE_VIOLATION) {
    const field = conflictingField(table, constraint);
    return new ProblemException(
      HttpStatus.CONFLICT,
      'already_exists',
      'A record with these values already exists',
      field ? [{ field, codes: ['alreadyExists'] }] : undefined,
    );
  }
  if (code === FOREIGN_KEY_VIOLATION) {
    return new ProblemException(
      HttpStatus.CONFLICT,
      'in_use',
      'This record is referenced elsewhere',
    );
  }
  return null;
}
