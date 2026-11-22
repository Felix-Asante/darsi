import { registerDecorator, type ValidationOptions } from 'class-validator';

/** A real calendar date written as `YYYY-MM-DD`, such as `2027-02-28` (not `2027-02-30`). */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function IsCalendarDate(options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'isCalendarDate',
      target: target.constructor,
      propertyName,
      options: {
        message: '$property must be a date written as YYYY-MM-DD',
        ...options,
      },
      validator: { validate: isCalendarDate },
    });
}
