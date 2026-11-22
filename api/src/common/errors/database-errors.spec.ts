import { QueryFailedError } from 'typeorm';
import { toProblemFromDatabase } from './database-errors.js';

const uniqueViolation = (table: string, constraint: string) =>
  new QueryFailedError(
    'INSERT',
    [],
    Object.assign(new Error('duplicate key'), {
      code: '23505',
      table,
      constraint,
    }),
  );

describe('toProblemFromDatabase', () => {
  it.each([
    ['students', 'students_school_id_student_number_key', 'studentNumber'],
    ['classes', 'classes_school_id_academic_year_id_code_key', 'code'],
    ['class_staff', 'class_staff_class_id_user_id_key', 'userId'],
  ])(
    'names the conflicting field of %s from its constraint',
    (table, constraint, field) => {
      const problem = toProblemFromDatabase(uniqueViolation(table, constraint));
      expect(problem?.getResponse()).toMatchObject({
        code: 'already_exists',
        errors: [{ field, codes: ['alreadyExists'] }],
      });
    },
  );

  it('leaves the field out for a named index', () => {
    const problem = toProblemFromDatabase(
      uniqueViolation('academic_years', 'academic_years_one_current'),
    );
    expect(
      (problem!.getResponse() as { errors?: unknown }).errors,
    ).toBeUndefined();
  });

  it('ignores errors that are not from the database', () => {
    expect(toProblemFromDatabase(new Error('boom'))).toBeNull();
  });
});
