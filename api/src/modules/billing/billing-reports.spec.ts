import { agingBucket } from './billing-reports.service.js';

describe('agingBucket', () => {
  it.each([
    [-5, 'current'],
    [0, 'current'],
    [1, '0_30'],
    [30, '0_30'],
    [31, '31_60'],
    [61, '61_90'],
    [90, '61_90'],
    [91, '90_plus'],
  ] as const)('%i days past due is %s', (days, bucket) => {
    expect(agingBucket(days)).toBe(bucket);
  });
});
