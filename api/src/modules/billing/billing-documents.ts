import { escapeHtml } from '../reports/report-html.js';
import { currencyOf } from './money/money.js';

type Locale = 'en' | 'fr';

/** `123456n` EUR in French → `1 234,56 €`, exact for any amount (no floats). */
export function formatMoney(
  amount: bigint,
  currency: string,
  locale: Locale,
): string {
  const digits = Number(currencyOf(currency).exponent);
  const negative = amount < 0n;
  const text = (negative ? -amount : amount)
    .toString()
    .padStart(digits + 1, '0');
  const decimal = `${negative ? '-' : ''}${digits ? `${text.slice(0, -digits)}.${text.slice(-digits)}` : text}`;
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    style: 'currency',
    currency,
  }).format(decimal as Intl.StringNumericLiteral);
}

const date = (value: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));

export const documentNumber = (prefix: string, number: number) =>
  `${prefix}-${String(number).padStart(6, '0')}`;

const COPY = {
  en: {
    invoice: 'Invoice',
    receipt: 'Receipt',
    billTo: 'Bill to',
    issued: 'Issue date',
    due: 'Due date',
    description: 'Description',
    student: 'Student',
    quantity: 'Qty',
    unit: 'Unit price',
    discount: 'Discount',
    tax: 'Tax',
    total: 'Total',
    subtotal: 'Subtotal',
    credits: 'Credit notes',
    paid: 'Paid',
    balance: 'Balance due',
    received: 'Received on',
    method: 'Method',
    reference: 'Reference',
    amount: 'Amount received',
    appliedTo: 'Applied to',
    credit: 'Kept as credit',
    methods: {
      cash: 'Cash',
      transfer: 'Bank transfer',
      cheque: 'Cheque',
      card: 'Card',
    },
  },
  fr: {
    invoice: 'Facture',
    receipt: 'Reçu',
    billTo: 'Facturé à',
    issued: 'Date d’émission',
    due: 'Échéance',
    description: 'Désignation',
    student: 'Élève',
    quantity: 'Qté',
    unit: 'Prix unitaire',
    discount: 'Remise',
    tax: 'TVA',
    total: 'Total',
    subtotal: 'Sous-total',
    credits: 'Avoirs',
    paid: 'Payé',
    balance: 'Reste à payer',
    received: 'Reçu le',
    method: 'Moyen de paiement',
    reference: 'Référence',
    amount: 'Montant reçu',
    appliedTo: 'Affecté à',
    credit: 'Conservé en crédit',
    methods: {
      cash: 'Espèces',
      transfer: 'Virement',
      cheque: 'Chèque',
      card: 'Carte',
    },
  },
} as const;

const STYLE = `
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif; color: #1c2333; font-size: 10pt; line-height: 1.45; }
  header { display: flex; justify-content: space-between; border-bottom: 2px solid #1f4b99; padding-bottom: 8px; margin-bottom: 16px; }
  h1 { font-size: 18pt; margin: 0; color: #1f4b99; }
  .number { font-family: 'IBM Plex Mono', monospace; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 3px 12px; margin: 0 0 16px; }
  dt { color: #5b6475; } dd { margin: 0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { text-align: left; font-size: 8.5pt; color: #5b6475; border-bottom: 1px solid #c9c4ba; padding: 5px 6px; }
  td { border-bottom: 1px solid #e5e2dc; padding: 6px; vertical-align: top; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .totals { margin-left: auto; width: 50%; }
  .totals td { border: none; padding: 3px 6px; }
  .grand td { font-weight: 700; border-top: 1px solid #1c2333; }`;

export interface InvoiceDocument {
  locale: Locale;
  schoolName: string;
  number: string;
  familyName: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  lines: {
    description: string;
    student: string | null;
    quantity: number;
    unitAmount: bigint;
    discount: bigint;
    tax: bigint;
    total: bigint;
  }[];
  subtotal: bigint;
  discountTotal: bigint;
  taxTotal: bigint;
  total: bigint;
  credits: { number: string; amount: bigint; reason: string }[];
  paid: bigint;
  balance: bigint;
}

export function renderInvoiceHtml(invoice: InvoiceDocument): string {
  const t = COPY[invoice.locale];
  const money = (amount: bigint) =>
    escapeHtml(formatMoney(amount, invoice.currency, invoice.locale));
  const rows = invoice.lines
    .map(
      (
        line,
      ) => `<tr><td>${escapeHtml(line.description)}</td><td>${escapeHtml(line.student ?? '')}</td>
        <td class="num">${line.quantity}</td><td class="num">${money(line.unitAmount)}</td>
        <td class="num">${line.discount ? `−${money(line.discount)}` : ''}</td><td class="num">${line.tax ? money(line.tax) : ''}</td>
        <td class="num">${money(line.total)}</td></tr>`,
    )
    .join('');
  const credits = invoice.credits
    .map(
      (credit) =>
        `<tr><td>${t.credits} <span class="number">${escapeHtml(credit.number)}</span> – ${escapeHtml(credit.reason)}</td><td class="num">−${money(credit.amount)}</td></tr>`,
    )
    .join('');
  return `<!doctype html><html lang="${invoice.locale}"><head><meta charset="utf-8"><title>${t.invoice} ${escapeHtml(invoice.number)}</title><style>${STYLE}</style></head><body>
<header><h1>${t.invoice} <span class="number">${escapeHtml(invoice.number)}</span></h1><strong>${escapeHtml(invoice.schoolName)}</strong></header>
<dl><dt>${t.billTo}</dt><dd>${escapeHtml(invoice.familyName)}</dd><dt>${t.issued}</dt><dd>${date(invoice.issueDate, invoice.locale)}</dd><dt>${t.due}</dt><dd>${date(invoice.dueDate, invoice.locale)}</dd></dl>
<table><thead><tr><th>${t.description}</th><th>${t.student}</th><th class="num">${t.quantity}</th><th class="num">${t.unit}</th><th class="num">${t.discount}</th><th class="num">${t.tax}</th><th class="num">${t.total}</th></tr></thead><tbody>${rows}</tbody></table>
<table class="totals"><tbody>
<tr><td>${t.subtotal}</td><td class="num">${money(invoice.subtotal)}</td></tr>
${invoice.discountTotal ? `<tr><td>${t.discount}</td><td class="num">−${money(invoice.discountTotal)}</td></tr>` : ''}
${invoice.taxTotal ? `<tr><td>${t.tax}</td><td class="num">${money(invoice.taxTotal)}</td></tr>` : ''}
<tr class="grand"><td>${t.total}</td><td class="num">${money(invoice.total)}</td></tr>
${credits}
${invoice.paid ? `<tr><td>${t.paid}</td><td class="num">−${money(invoice.paid)}</td></tr>` : ''}
<tr class="grand"><td>${t.balance}</td><td class="num">${money(invoice.balance)}</td></tr>
</tbody></table></body></html>`;
}

export interface ReceiptDocument {
  locale: Locale;
  schoolName: string;
  number: string;
  familyName: string;
  receivedOn: string;
  method: keyof (typeof COPY)['en']['methods'];
  reference: string | null;
  currency: string;
  amount: bigint;
  allocations: { invoiceNumber: string; amount: bigint }[];
  credit: bigint;
}

export function renderReceiptHtml(receipt: ReceiptDocument): string {
  const t = COPY[receipt.locale];
  const money = (amount: bigint) =>
    escapeHtml(formatMoney(amount, receipt.currency, receipt.locale));
  const rows = receipt.allocations
    .map(
      (entry) =>
        `<tr><td>${t.appliedTo} <span class="number">${escapeHtml(entry.invoiceNumber)}</span></td><td class="num">${money(entry.amount)}</td></tr>`,
    )
    .join('');
  return `<!doctype html><html lang="${receipt.locale}"><head><meta charset="utf-8"><title>${t.receipt} ${escapeHtml(receipt.number)}</title><style>${STYLE}</style></head><body>
<header><h1>${t.receipt} <span class="number">${escapeHtml(receipt.number)}</span></h1><strong>${escapeHtml(receipt.schoolName)}</strong></header>
<dl><dt>${t.billTo}</dt><dd>${escapeHtml(receipt.familyName)}</dd><dt>${t.received}</dt><dd>${date(receipt.receivedOn, receipt.locale)}</dd>
<dt>${t.method}</dt><dd>${t.methods[receipt.method]}</dd>${receipt.reference ? `<dt>${t.reference}</dt><dd>${escapeHtml(receipt.reference)}</dd>` : ''}</dl>
<table class="totals"><tbody><tr class="grand"><td>${t.amount}</td><td class="num">${money(receipt.amount)}</td></tr>${rows}
${receipt.credit ? `<tr><td>${t.credit}</td><td class="num">${money(receipt.credit)}</td></tr>` : ''}</tbody></table></body></html>`;
}
