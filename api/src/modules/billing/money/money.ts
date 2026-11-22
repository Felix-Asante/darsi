import {
  add,
  dinero,
  type Dinero,
  halfEven,
  halfUp,
  multiply,
  toSnapshot,
  transformScale,
} from 'dinero.js/bigint';
import * as currencies from 'dinero.js/bigint/currencies';

/** All money is integer minor units of one ISO 4217 currency (FEE-1). */
export type Minor = bigint;

export const ROUNDING_MODES = ['half_up', 'half_even'] as const;
export type RoundingMode = (typeof ROUNDING_MODES)[number];

/** One whole: 10 000 basis points. Rates and percentage discounts use basis points. */
export const BASIS_POINTS = 10_000n;

type Currency = (typeof currencies)[keyof typeof currencies];

export function currencyOf(code: string): Currency {
  const currency = (currencies as Record<string, Currency>)[code.toUpperCase()];
  if (!currency) throw new Error(`Unknown currency ${code}`);
  return currency;
}

export const toDinero = (amount: Minor, currency: string): Dinero<bigint> =>
  dinero({ amount, currency: currencyOf(currency) });

const minorOf = (value: Dinero<bigint>): Minor => toSnapshot(value).amount;

/** `amount × rate / 10 000`, rounded to the currency's minor unit with the school's rule. */
export function applyRate(
  amount: Minor,
  currency: string,
  rateBp: bigint,
  rounding: RoundingMode,
): Minor {
  const exponent = currencyOf(currency).exponent;
  const scaled = multiply(toDinero(amount, currency), {
    amount: rateBp,
    scale: 4n,
  });
  return minorOf(
    transformScale(
      scaled,
      exponent,
      rounding === 'half_even' ? halfEven : halfUp,
    ),
  );
}

export function sum(amounts: Minor[], currency: string): Minor {
  return minorOf(
    amounts.reduce(
      (total, amount) => add(total, toDinero(amount, currency)),
      toDinero(0n, currency),
    ),
  );
}

export const min = (a: Minor, b: Minor): Minor => (a < b ? a : b);
export const max = (a: Minor, b: Minor): Minor => (a > b ? a : b);
