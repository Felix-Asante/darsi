import { SnakeNamingStrategy } from './snake-naming.strategy.js';

describe('SnakeNamingStrategy', () => {
  const strategy = new SnakeNamingStrategy();

  it('names tables and columns in snake_case', () => {
    expect(strategy.tableName('InvoiceLine')).toBe('invoice_line');
    expect(strategy.columnName('schoolId', undefined, [])).toBe('school_id');
    expect(strategy.columnName('ISOCode', undefined, [])).toBe('iso_code');
  });

  it('keeps explicit names and prefixes embedded columns', () => {
    expect(strategy.tableName('AuditEvent', 'audit_events')).toBe(
      'audit_events',
    );
    expect(strategy.columnName('minorUnits', undefined, ['amount'])).toBe(
      'amount_minor_units',
    );
  });

  it('names join columns after the relation', () => {
    expect(strategy.joinColumnName('gradeLevel', 'id')).toBe('grade_level_id');
  });
});
