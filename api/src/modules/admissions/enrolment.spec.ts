import { nextGrades } from './enrolment.service.js';

describe('nextGrades', () => {
  it('moves each grade up, across divisions, and leaves the last grade with none', () => {
    const next = nextGrades([
      { gradeLevels: [{ id: 'g5' }, { id: 'g6' }] },
      { gradeLevels: [{ id: 'g7' }] },
    ]);
    expect(Object.fromEntries(next)).toEqual({ g5: 'g6', g6: 'g7', g7: null });
  });
});
