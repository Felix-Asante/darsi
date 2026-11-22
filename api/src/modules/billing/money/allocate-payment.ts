import { min, type Minor } from './money.js';

export interface OpenInvoice {
  id: string;
  dueOn: string;
  issuedOn: string;
  number: number;
  outstanding: Minor;
}

export interface Allocation {
  allocations: { invoiceId: string; amount: Minor }[];
  /** What is left over becomes family credit (FEE-13). */
  credit: Minor;
}

/**
 * Spreads a payment over a family's open invoices: the chosen invoice only, or
 * oldest due first (then oldest issued, then lowest number). Never more than
 * an invoice still owes.
 */
export function allocatePayment(
  amount: Minor,
  invoices: OpenInvoice[],
  chosenInvoiceId?: string,
): Allocation {
  if (amount < 0n) throw new RangeError('A payment cannot be negative');
  const open = invoices.filter((invoice) => invoice.outstanding > 0n);
  const order = chosenInvoiceId
    ? open.filter((invoice) => invoice.id === chosenInvoiceId)
    : [...open].sort(
        (a, b) =>
          a.dueOn.localeCompare(b.dueOn) ||
          a.issuedOn.localeCompare(b.issuedOn) ||
          a.number - b.number,
      );

  let remaining = amount;
  const allocations: Allocation['allocations'] = [];
  for (const invoice of order) {
    if (remaining === 0n) break;
    const share = min(remaining, invoice.outstanding);
    allocations.push({ invoiceId: invoice.id, amount: share });
    remaining -= share;
  }
  return { allocations, credit: remaining };
}
