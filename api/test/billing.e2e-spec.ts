import type { INestApplication } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import Stripe from 'stripe';
import { v7 as uuidv7 } from 'uuid';
import { addDays, todayIn } from '../src/common/dates/calendar-date.js';
import { TenantTransactions } from '../src/common/tenancy/tenant-transactions.js';
import { AuditEvent } from '../src/modules/audit/audit-event.entity.js';
import { BillingSetupService } from '../src/modules/billing/billing-setup.service.js';
import { PaymentGateway } from '../src/modules/billing/payment-gateway.js';
import { ImportsService } from '../src/modules/imports/imports.service.js';
import { createTestApp } from './support/create-test-app.js';
import {
  addMember,
  createSchool,
  type CreatedSchool,
  deliverMail,
  mailbox,
  uniqueEmail,
} from './support/identity.js';

describe('Fees, invoices and payments (e2e)', () => {
  let app: INestApplication;
  const today = todayIn('Europe/Paris');

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const inSchool = <T>(school: CreatedSchool, work: () => Promise<T>) =>
    app.get(TenantTransactions).runInSchool(school.id, work);
  const txHost = () =>
    app.get<TransactionHost<TransactionalAdapterTypeOrm>>(TransactionHost);

  async function importCsv(
    school: CreatedSchool,
    kind: string,
    content: string,
  ) {
    const { body } = await school.admin
      .post('/api/v1/imports')
      .send({ kind, fileName: `${kind}.csv`, content })
      .expect(201);
    await app
      .get(ImportsService)
      .process({ jobId: body.id, schoolId: school.id });
  }

  /** A school with term fees, families of two siblings, and a 10% sibling discount on the younger one's tuition. */
  async function setUp(families: number) {
    const school = await createSchool(app);
    const post = async (path: string, body: object) =>
      (await school.admin.post(`/api/v1${path}`).send(body).expect(201)).body;
    const year = await post('/academics/years', {
      name: 'Year',
      startsOn: addDays(today, -30),
      endsOn: addDays(today, 300),
    });
    const term = await post(`/academics/years/${year.id}/terms`, {
      name: 'Term 1',
      startsOn: addDays(today, -30),
      endsOn: addDays(today, 60),
    });
    const finance = await addMember(app, school, ['finance_officer']);
    const teacher = await addMember(app, school, ['teacher']);

    const students = ['student_number,first_name,last_name'];
    const guardians = [
      'email,first_name,last_name,student_numbers,relationship',
    ];
    const tag = uuidv7().slice(-6);
    for (let index = 0; index < families; index += 1) {
      students.push(
        `A${index}-${tag},Older${index},Family${index}`,
        `B${index}-${tag},Younger${index},Family${index}`,
      );
      guardians.push(
        `parent${index}-${tag}@example.test,Parent${index},Family${index},A${index}-${tag};B${index}-${tag},mother`,
      );
    }
    await importCsv(school, 'students', students.join('\n'));
    await importCsv(school, 'guardians', guardians.join('\n'));

    const { body: tuition } = await finance.session
      .post('/api/v1/billing/fee-items')
      .send({
        name: 'Tuition',
        kind: 'tuition',
        amount: '450000',
        taxRateBp: 0,
      })
      .expect(201);
    const { body: lunch } = await finance.session
      .post('/api/v1/billing/fee-items')
      .send({
        name: 'Lunch',
        kind: 'other',
        amount: '30000',
        taxRateBp: 550,
        accountingCode: '7061',
      })
      .expect(201);
    await finance.session
      .put('/api/v1/billing/structures')
      .send({
        academicYearId: year.id,
        name: 'Middle school',
        schedule: 'term',
        lines: [
          { feeItemId: tuition.id, amount: '450000' },
          { feeItemId: lunch.id, amount: '30000' },
        ],
      })
      .expect(200);
    const { body: sibling } = await finance.session
      .post('/api/v1/billing/discounts')
      .send({
        name: 'Sibling',
        kind: 'percent',
        value: '1000',
        feeItemIds: [tuition.id],
      })
      .expect(201);
    const younger = await inSchool(school, () =>
      txHost().tx.query<{ id: string }[]>(
        `SELECT id FROM students WHERE first_name LIKE 'Younger%'`,
      ),
    );
    await inSchool(school, async () => {
      for (const { id } of younger)
        await app
          .get(BillingSetupService)
          .setStudentDiscounts(id, [sibling.id]);
    });
    return { school, finance, teacher, year, term, tag };
  }

  it('invoices 500 students as one invoice per family, exactly, and never twice (FEE-5/7/8)', async () => {
    const { school, finance, teacher, year, term } = await setUp(250);
    const period = {
      academicYearId: year.id,
      schedule: 'term',
      termId: term.id,
    };

    const { body: preview } = await finance.session
      .post('/api/v1/billing/runs/preview')
      .send(period)
      .expect(200);
    expect(preview.families).toHaveLength(250);
    // Per family: 2 × 4 500,00 tuition − 450,00 sibling discount + 2 × (300,00 lunch + 5,5% VAT 16,50) = 9 183,00.
    expect(preview.families[0].total).toBe('918300');
    expect(preview.total).toBe(String(918300 * 250));

    const started = performance.now();
    const { body: run } = await finance.session
      .post('/api/v1/billing/runs')
      .send(period)
      .expect(200);
    expect(performance.now() - started).toBeLessThan(60_000);
    expect(run).toMatchObject({ issued: 250, skipped: 0 });
    const { body: again } = await finance.session
      .post('/api/v1/billing/runs')
      .send(period)
      .expect(200);
    expect(again).toMatchObject({ issued: 0, skipped: 250 });

    const { body: invoices } = await finance.session
      .get('/api/v1/billing/invoices?status=issued')
      .expect(200);
    expect(invoices).toHaveLength(250);
    const numbers = invoices
      .map((invoice: { number: string }) => Number(invoice.number.slice(4)))
      .sort((a: number, b: number) => a - b);
    expect(numbers).toEqual(
      Array.from({ length: 250 }, (_, index) => index + 1),
    );
    const { body: detail } = await finance.session
      .get(`/api/v1/billing/invoices/${invoices[0].id}`)
      .expect(200);
    expect(detail).toMatchObject({
      subtotal: '960000',
      discountTotal: '45000',
      taxTotal: '3300',
      total: '918300',
      state: 'open',
    });
    expect(detail.lines).toHaveLength(4);

    // Issued invoices are immutable at the database level; corrections are credit notes.
    await expect(
      inSchool(school, () =>
        txHost().tx.query(`UPDATE invoices SET total = 1 WHERE id = $1`, [
          invoices[0].id,
        ]),
      ),
    ).rejects.toThrow(/credit note/);
    const { body: credited } = await finance.session
      .post(`/api/v1/billing/invoices/${invoices[0].id}/credit-notes`)
      .send({ amount: '18300', reason: 'Lunch charged twice' })
      .expect(201);
    expect(credited).toMatchObject({
      credited: '18300',
      balance: '900000',
      creditNotes: [{ number: 'CN-000001' }],
    });
    const audit = await inSchool(school, () =>
      txHost().tx.find(AuditEvent, { where: { entityId: invoices[0].id } }),
    );
    expect(audit.map((event) => event.action).sort()).toEqual([
      'invoice.credited',
      'invoice.issued',
    ]);

    // Academic staff never see fees.
    await teacher.session.get('/api/v1/billing/invoices').expect(403);
    await teacher.session
      .get('/api/v1/billing/reports/outstanding')
      .expect(403);
  }, 180_000);

  it('allocates payments oldest first, keeps overpayments as credit, applies credit and refunds (FEE-11/13/16)', async () => {
    const { finance, year, term } = await setUp(1);
    await finance.session
      .post('/api/v1/billing/runs')
      .send({ academicYearId: year.id, schedule: 'term', termId: term.id })
      .expect(200);
    const {
      body: [first],
    } = await finance.session.get('/api/v1/billing/invoices').expect(200);
    const { body: oneOff } = await finance.session
      .post('/api/v1/billing/invoices')
      .send({
        familyId: first.familyId,
        lines: [
          {
            description: 'Trip',
            quantity: 1,
            unitAmount: '12000',
            taxRateBp: 0,
          },
        ],
      })
      .expect(201);
    await finance.session
      .post(`/api/v1/billing/invoices/${oneOff.id}/issue`)
      .send({ dueDate: addDays(today, 90) })
      .expect(200);

    const { body: payment } = await finance.session
      .post('/api/v1/billing/payments')
      .send({
        familyId: first.familyId,
        amount: '1000000',
        method: 'transfer',
        reference: 'VIR-1',
        receivedOn: today,
      })
      .expect(201);
    expect(payment).toMatchObject({
      receipt: 'RCT-000001',
      credit: String(1000000 - 918300 - 12000),
    });
    expect(
      payment.allocations.map((entry: { amount: string }) => entry.amount),
    ).toEqual(['918300', '12000']);

    const { body: next } = await finance.session
      .post('/api/v1/billing/invoices')
      .send({
        familyId: first.familyId,
        lines: [
          {
            description: 'Uniform',
            quantity: 2,
            unitAmount: '25000',
            taxRateBp: 0,
          },
        ],
      })
      .expect(201);
    const { body: issued } = await finance.session
      .post(`/api/v1/billing/invoices/${next.id}/issue`)
      .send({})
      .expect(200);
    expect(issued).toMatchObject({
      total: '50000',
      paid: '50000',
      state: 'paid',
    });

    const { body: refunded } = await finance.session
      .post(`/api/v1/billing/payments/${payment.id}/refunds`)
      .send({ amount: '30000', reason: 'Trip cancelled' })
      .expect(201);
    expect(refunded).toMatchObject({ refunded: '30000', credit: '0' });
    const { body: reopened } = await finance.session
      .get(`/api/v1/billing/invoices/${next.id}`)
      .expect(200);
    expect(reopened.balance).toBe('10300');
    await finance.session
      .post(`/api/v1/billing/payments/${payment.id}/refunds`)
      .send({ amount: '999999999', reason: 'x' })
      .expect(422);

    const { body: accounts } = await finance.session
      .get('/api/v1/billing/families')
      .expect(200);
    expect(accounts).toEqual([
      expect.objectContaining({
        familyId: first.familyId,
        balance: '10300',
        credit: '0',
      }),
    ]);
    const { body: aging } = await finance.session
      .get('/api/v1/billing/reports/outstanding')
      .expect(200);
    expect(aging).toMatchObject({
      totals: { total: '10300', current: '10300' },
    });
  });

  it('marks an invoice paid only from a verified Stripe webhook, once (FEE-12)', async () => {
    const { school, finance, year, term, tag } = await setUp(1);
    await finance.session
      .post('/api/v1/billing/runs')
      .send({ academicYearId: year.id, schedule: 'term', termId: term.id })
      .expect(200);
    const {
      body: [invoice],
    } = await finance.session.get('/api/v1/billing/invoices').expect(200);
    await inSchool(school, () =>
      app.get(BillingSetupService).connectStripe('acct_test_school'),
    );

    const parentEmail = `parent0-${tag}@example.test`;
    const parent = await addMember(app, school, ['guardian'], parentEmail);
    await deliverMail(app);
    const stranger = await addMember(
      app,
      school,
      ['guardian'],
      uniqueEmail('stranger'),
    );
    const gateway = app.get(PaymentGateway);
    const checkout = vi
      .spyOn(gateway, 'createCheckout')
      .mockResolvedValue({ url: 'https://checkout.stripe.test/session' });

    await parent.session
      .post(`/api/v1/billing/invoices/${invoice.id}/checkout`)
      .expect(400);
    const { body: session } = await parent.session
      .post(`/api/v1/billing/invoices/${invoice.id}/checkout?locale=fr`)
      .set('Idempotency-Key', 'click-1234567')
      .expect(200);
    expect(session.url).toBe('https://checkout.stripe.test/session');
    expect(checkout).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'acct_test_school',
        amount: 918300n,
        currency: 'EUR',
        idempotencyKey: `checkout:${invoice.id}:click-1234567`,
      }),
    );
    await stranger.session
      .post(`/api/v1/billing/invoices/${invoice.id}/checkout`)
      .set('Idempotency-Key', 'click-1234567')
      .expect(403);

    const event = {
      id: `evt_${uuidv7()}`,
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          object: 'checkout.session',
          payment_status: 'paid',
          payment_intent: `pi_${uuidv7()}`,
          amount_total: 918300,
          currency: 'eur',
          metadata: { schoolId: school.id, invoiceId: invoice.id },
        },
      },
    };
    const payload = JSON.stringify(event);
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: 'whsec_test_secret',
    });
    const send = (body: string, header: string) =>
      parent.session
        .post('/api/v1/billing/webhooks/stripe')
        .set('Origin', '')
        .set('stripe-signature', header)
        .set('content-type', 'application/json')
        .send(body);

    await send(payload, 't=1,v1=forged').expect(400);
    const { body: unpaid } = await finance.session
      .get(`/api/v1/billing/invoices/${invoice.id}`)
      .expect(200);
    expect(unpaid.state).toBe('open');

    expect((await send(payload, signature).expect(200)).body).toEqual({
      received: true,
    });
    expect((await send(payload, signature).expect(200)).body).toEqual({
      received: true,
      duplicate: true,
    });
    const { body: paid } = await finance.session
      .get(`/api/v1/billing/invoices/${invoice.id}`)
      .expect(200);
    expect(paid).toMatchObject({ state: 'paid', paid: '918300', balance: '0' });
    const { body: payments } = await finance.session
      .get(`/api/v1/billing/payments?familyId=${invoice.familyId}`)
      .expect(200);
    expect(payments).toHaveLength(1);

    await deliverMail(app);
    const receipt = mailbox(app)
      .filter({ to: parentEmail })
      .find((mail) => mail.template === 'notice');
    expect(receipt?.subject).toBe('Payment received: €9,183.00');

    const { body: statements } = await parent.session
      .get('/api/v1/billing/statements')
      .expect(200);
    expect(statements).toEqual([
      expect.objectContaining({
        balance: '0',
        invoices: [expect.objectContaining({ state: 'paid' })],
      }),
    ]);
    const pdf = await parent.session
      .get(`/api/v1/billing/invoices/${invoice.id}/pdf?locale=fr`)
      .expect(200)
      .buffer(true);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    await stranger.session
      .get(`/api/v1/billing/invoices/${invoice.id}`)
      .expect(403);
  });
});
