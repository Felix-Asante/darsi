import {
  documentNumber,
  formatMoney,
  renderInvoiceHtml,
  renderReceiptHtml,
} from './billing-documents.js';

const normalize = (value: string) => value.replace(/[  ]/g, ' ');

describe('formatMoney', () => {
  it('formats minor units exactly in each language and currency', () => {
    expect(normalize(formatMoney(123456n, 'EUR', 'fr'))).toBe('1 234,56 €');
    expect(formatMoney(123456n, 'GBP', 'en')).toBe('£1,234.56');
    expect(normalize(formatMoney(1500n, 'JPY', 'fr'))).toBe('1 500 JPY');
    expect(formatMoney(-5n, 'USD', 'en')).toBe('-US$0.05');
    expect(formatMoney(900719925474099312n, 'EUR', 'en')).toBe(
      '€9,007,199,254,740,993.12',
    );
  });
});

describe('invoice and receipt documents', () => {
  it('prints an invoice with credits, payments and balance, escaping names', () => {
    const html = normalize(
      renderInvoiceHtml({
        locale: 'fr',
        schoolName: 'École du Lac',
        number: documentNumber('INV', 42),
        familyName: 'Famille <Haddad>',
        issueDate: '2026-09-01',
        dueDate: '2026-10-01',
        currency: 'EUR',
        lines: [
          {
            description: 'Scolarité T1',
            student: 'Amira',
            quantity: 1,
            unitAmount: 450000n,
            discount: 45000n,
            tax: 0n,
            total: 405000n,
          },
        ],
        subtotal: 450000n,
        discountTotal: 45000n,
        taxTotal: 0n,
        total: 405000n,
        credits: [{ number: 'CN-000001', amount: 5000n, reason: 'Erreur' }],
        paid: 100000n,
        balance: 300000n,
      }),
    );
    expect(html).toContain('Facture <span class="number">INV-000042</span>');
    expect(html).toContain('Famille &lt;Haddad&gt;');
    expect(html).toContain('1 septembre 2026');
    expect(html).toContain('−450,00 €');
    expect(html).toContain('3 000,00 €');
  });

  it('prints a receipt with where the money went', () => {
    const html = renderReceiptHtml({
      locale: 'en',
      schoolName: 'Greenfield',
      number: documentNumber('RCT', 7),
      familyName: 'Haddad family',
      receivedOn: '2026-10-02',
      method: 'transfer',
      reference: 'BANK-123',
      currency: 'EUR',
      amount: 500000n,
      allocations: [{ invoiceNumber: 'INV-000042', amount: 405000n }],
      credit: 95000n,
    });
    expect(html).toContain('Bank transfer');
    expect(html).toContain('€4,050.00');
    expect(html).toContain('Kept as credit');
  });
});
