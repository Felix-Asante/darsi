import fc from 'fast-check';
import { allocatePayment, type OpenInvoice } from './allocate-payment.js';
import { calculateInvoice, type FeeLineInput } from './fee-calculator.js';
import { applyRate, sum } from './money.js';

const line = (overrides: Partial<FeeLineInput> = {}): FeeLineInput => ({
  key: 'l1',
  studentId: 's1',
  feeItemId: 'tuition',
  description: 'Tuition',
  quantity: 1,
  unitAmount: 450_000n,
  taxRateBp: 0,
  ...overrides,
});

describe('applyRate', () => {
  it('rounds to the currency’s minor unit with the school’s rule', () => {
    expect(applyRate(1_005n, 'EUR', 5_000n, 'half_up')).toBe(503n);
    expect(applyRate(1_005n, 'EUR', 5_000n, 'half_even')).toBe(502n);
    expect(applyRate(333n, 'EUR', 2_000n, 'half_up')).toBe(67n);
    expect(applyRate(1_000n, 'JPY', 1_000n, 'half_up')).toBe(100n);
    expect(applyRate(1_005n, 'KWD', 5_000n, 'half_up')).toBe(503n);
  });

  it('adds without floating point, even for huge amounts', () => {
    expect(sum([9_007_199_254_740_993n, 1n], 'EUR')).toBe(
      9_007_199_254_740_994n,
    );
  });
});

describe('calculateInvoice', () => {
  it('applies sibling and fixed discounts, then tax on what remains', () => {
    const invoice = calculateInvoice(
      'EUR',
      [
        line({ key: 'a', studentId: 'amira' }),
        line({ key: 'y', studentId: 'yasmine' }),
        line({
          key: 'trip',
          studentId: 'yasmine',
          feeItemId: 'trip',
          description: 'Trip',
          unitAmount: 12_000n,
          taxRateBp: 2_000,
        }),
      ],
      [
        {
          label: 'Sibling 10%',
          studentId: 'yasmine',
          kind: 'percent',
          value: 1_000n,
          feeItemIds: ['tuition'],
        },
        {
          label: 'Bursary',
          studentId: 'yasmine',
          kind: 'fixed',
          value: 5_000n,
          feeItemIds: ['trip'],
        },
      ],
      'half_up',
    );
    expect(
      invoice.lines.map(({ key, discount, tax, total }) => ({
        key,
        discount,
        tax,
        total,
      })),
    ).toEqual([
      { key: 'a', discount: 0n, tax: 0n, total: 450_000n },
      { key: 'y', discount: 45_000n, tax: 0n, total: 405_000n },
      { key: 'trip', discount: 5_000n, tax: 1_400n, total: 8_400n },
    ]);
    expect(invoice).toMatchObject({
      subtotal: 912_000n,
      discountTotal: 50_000n,
      taxTotal: 1_400n,
      total: 863_400n,
    });
  });

  it('never discounts a line below zero', () => {
    const invoice = calculateInvoice(
      'EUR',
      [line({ unitAmount: 100n })],
      [
        {
          label: 'Full',
          studentId: 's1',
          kind: 'percent',
          value: 8_000n,
          feeItemIds: [],
        },
        {
          label: 'Extra',
          studentId: 's1',
          kind: 'fixed',
          value: 1_000n,
          feeItemIds: [],
        },
      ],
      'half_up',
    );
    expect(invoice.lines[0]).toMatchObject({
      discount: 100n,
      net: 0n,
      total: 0n,
    });
  });

  it('always adds up: lines to totals, subtotal less discounts plus tax to the total', () => {
    const lineArb = fc.record({
      studentId: fc.constantFrom('a', 'b'),
      feeItemId: fc.constantFrom('tuition', 'trip'),
      quantity: fc.integer({ min: 1, max: 12 }),
      unitAmount: fc.bigInt({ min: 0n, max: 10_000_000n }),
      taxRateBp: fc.integer({ min: 0, max: 3_000 }),
    });
    const discountArb = fc.record({
      studentId: fc.constantFrom('a', 'b'),
      kind: fc.constantFrom('percent' as const, 'fixed' as const),
      value: fc.bigInt({ min: 0n, max: 10_000n }),
      feeItemIds: fc.constantFrom([], ['tuition'], ['trip']),
    });
    fc.assert(
      fc.property(
        fc.array(lineArb, { maxLength: 10 }),
        fc.array(discountArb, { maxLength: 4 }),
        fc.constantFrom('half_up' as const, 'half_even' as const),
        (lines, discounts, rounding) => {
          const invoice = calculateInvoice(
            'EUR',
            lines.map((entry, index) =>
              line({ ...entry, key: String(index), description: 'x' }),
            ),
            discounts.map((entry) => ({
              ...entry,
              feeItemIds: [...entry.feeItemIds],
              label: 'd',
            })),
            rounding,
          );
          expect(
            invoice.subtotal - invoice.discountTotal + invoice.taxTotal,
          ).toBe(invoice.total);
          for (const entry of invoice.lines) {
            expect(entry.discount >= 0n && entry.discount <= entry.amount).toBe(
              true,
            );
            expect(entry.total).toBe(entry.net + entry.tax);
          }
        },
      ),
    );
  });
});

describe('allocatePayment', () => {
  const invoices: OpenInvoice[] = [
    {
      id: 'term2',
      dueOn: '2027-01-15',
      issuedOn: '2026-12-01',
      number: 12,
      outstanding: 40_000n,
    },
    {
      id: 'term1',
      dueOn: '2026-10-15',
      issuedOn: '2026-09-01',
      number: 3,
      outstanding: 25_000n,
    },
    {
      id: 'paid',
      dueOn: '2026-09-15',
      issuedOn: '2026-09-01',
      number: 1,
      outstanding: 0n,
    },
  ];

  it('pays the oldest due invoice first and keeps the rest as credit', () => {
    expect(allocatePayment(80_000n, invoices)).toEqual({
      allocations: [
        { invoiceId: 'term1', amount: 25_000n },
        { invoiceId: 'term2', amount: 40_000n },
      ],
      credit: 15_000n,
    });
    expect(allocatePayment(10_000n, invoices).allocations).toEqual([
      { invoiceId: 'term1', amount: 10_000n },
    ]);
  });

  it('pays only the chosen invoice when the family picks one', () => {
    expect(allocatePayment(50_000n, invoices, 'term2')).toEqual({
      allocations: [{ invoiceId: 'term2', amount: 40_000n }],
      credit: 10_000n,
    });
  });

  it('accounts for every minor unit and never overpays an invoice', () => {
    const invoiceArb = fc.record({
      id: fc.uuid(),
      dueOn: fc.constantFrom('2026-09-01', '2026-10-01', '2026-11-01'),
      issuedOn: fc.constantFrom('2026-08-01', '2026-08-15'),
      number: fc.integer({ min: 1, max: 1000 }),
      outstanding: fc.bigInt({ min: 0n, max: 1_000_000n }),
    });
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 5_000_000n }),
        fc.array(invoiceArb, { maxLength: 8 }),
        (amount, open) => {
          const { allocations, credit } = allocatePayment(amount, open);
          expect(
            allocations.reduce((total, entry) => total + entry.amount, 0n) +
              credit,
          ).toBe(amount);
          for (const entry of allocations) {
            const invoice = open.find(
              (candidate) => candidate.id === entry.invoiceId,
            )!;
            expect(
              entry.amount > 0n && entry.amount <= invoice.outstanding,
            ).toBe(true);
          }
          const owed = open.reduce(
            (total, invoice) => total + invoice.outstanding,
            0n,
          );
          expect(credit).toBe(amount > owed ? amount - owed : 0n);
        },
      ),
    );
  });

  it('refuses negative payments', () => {
    expect(() => allocatePayment(-1n, invoices)).toThrow(RangeError);
  });
});
