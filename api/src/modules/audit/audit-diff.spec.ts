import { diffSnapshots } from './audit-diff.js';

describe('diffSnapshots', () => {
  it('keeps only the fields that changed', () => {
    const before = { grade: '5', comment: 'Good', studentId: 's1' };
    const after = { grade: '6', comment: 'Good', studentId: 's1' };

    expect(diffSnapshots(before, after)).toEqual({
      grade: { before: '5', after: '6' },
    });
  });

  it('records every field of a creation and a deletion', () => {
    expect(diffSnapshots(null, { status: 'issued' })).toEqual({
      status: { before: null, after: 'issued' },
    });
    expect(diffSnapshots({ status: 'draft' }, null)).toEqual({
      status: { before: 'draft', after: null },
    });
  });

  it('compares nested values by content and ignores bookkeeping fields', () => {
    const before = {
      lines: [{ amount: 100 }],
      version: 1,
      updatedAt: new Date(0),
    };
    const after = {
      lines: [{ amount: 100 }],
      version: 2,
      updatedAt: new Date(),
    };

    expect(diffSnapshots(before, after)).toBeNull();
  });
});
