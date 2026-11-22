import {
  applyRate,
  max,
  min,
  type Minor,
  type RoundingMode,
  sum,
} from './money.js';

export interface FeeLineInput {
  key: string;
  studentId: string | null;
  feeItemId: string | null;
  description: string;
  quantity: number;
  unitAmount: Minor;
  /** Tax added on top of the discounted amount, in basis points (2000 = 20%). */
  taxRateBp: number;
}

export interface DiscountInput {
  label: string;
  studentId: string;
  kind: 'percent' | 'fixed';
  /** Basis points for percentages, minor units for fixed amounts. */
  value: bigint;
  /** Fee items it applies to; empty for all of the student's lines. */
  feeItemIds: string[];
}

export interface CalculatedLine extends FeeLineInput {
  amount: Minor;
  discount: Minor;
  net: Minor;
  tax: Minor;
  total: Minor;
}

export interface CalculatedInvoice {
  lines: CalculatedLine[];
  subtotal: Minor;
  discountTotal: Minor;
  taxTotal: Minor;
  total: Minor;
}

/**
 * Invoice totals, exact to the minor unit (FEE-7):
 * - each line's amount is quantity × unit amount;
 * - percentage discounts apply to each matching line and are rounded per line;
 * - fixed discounts are spread over the student's matching lines in order, never below zero;
 * - tax is charged on what remains, rounded per line;
 * - totals are the sums of the rounded lines, so lines always add up to the total.
 */
export function calculateInvoice(
  currency: string,
  lines: FeeLineInput[],
  discounts: DiscountInput[],
  rounding: RoundingMode,
): CalculatedInvoice {
  const applies = (discount: DiscountInput, line: FeeLineInput) =>
    line.studentId === discount.studentId &&
    (discount.feeItemIds.length === 0 ||
      (line.feeItemId !== null &&
        discount.feeItemIds.includes(line.feeItemId)));

  const calculated = lines.map((line) => ({
    ...line,
    amount: line.unitAmount * BigInt(line.quantity),
    discount: 0n,
  }));

  for (const discount of discounts.filter(
    (entry) => entry.kind === 'percent',
  )) {
    for (const line of calculated.filter((entry) => applies(discount, entry))) {
      line.discount += applyRate(
        line.amount,
        currency,
        discount.value,
        rounding,
      );
    }
  }
  for (const discount of discounts.filter((entry) => entry.kind === 'fixed')) {
    let remaining = discount.value;
    for (const line of calculated.filter((entry) => applies(discount, entry))) {
      const room = max(0n, line.amount - line.discount);
      const taken = min(room, remaining);
      line.discount += taken;
      remaining -= taken;
    }
  }

  const result = calculated.map((line) => {
    const discount = min(line.discount, line.amount);
    const net = line.amount - discount;
    const tax = applyRate(net, currency, BigInt(line.taxRateBp), rounding);
    return { ...line, discount, net, tax, total: net + tax };
  });
  return {
    lines: result,
    subtotal: sum(
      result.map((line) => line.amount),
      currency,
    ),
    discountTotal: sum(
      result.map((line) => line.discount),
      currency,
    ),
    taxTotal: sum(
      result.map((line) => line.tax),
      currency,
    ),
    total: sum(
      result.map((line) => line.total),
      currency,
    ),
  };
}
