import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In, QueryFailedError } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { appLink } from '../../common/http/app-links.js';
import { ProblemException } from '../../common/errors/problem.exception.js';
import { RequestContext } from '../../common/tenancy/request-context.js';
import { TenantTransactions } from '../../common/tenancy/tenant-transactions.js';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import { AuditService } from '../audit/audit.service.js';
import { DocumentRenderer } from '../documents/document-renderer.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PeopleService } from '../people/people.service.js';
import { SchoolClock } from '../schools/school-clock.service.js';
import { SchoolsService } from '../schools/schools.service.js';
import {
  documentNumber,
  formatMoney,
  renderReceiptHtml,
} from './billing-documents.js';
import type { PaymentDto } from './billing.dto.js';
import {
  Invoice,
  Payment,
  PaymentAllocation,
  PaymentProviderEvent,
  Refund,
} from './billing.entities.js';
import { BillingSetupService, minorString } from './billing-setup.service.js';
import { InvoicesService } from './invoices.service.js';
import { LedgerService } from './ledger.service.js';
import { allocatePayment } from './money/allocate-payment.js';
import { PaymentGateway } from './payment-gateway.js';

const problem = (
  status: HttpStatus,
  code: string,
  field?: string,
  fieldCode?: string,
) =>
  new ProblemException(
    status,
    code,
    undefined,
    field ? [{ field, codes: [fieldCode ?? code] }] : undefined,
  );

@Injectable()
export class PaymentsService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly context: RequestContext,
    private readonly transactions: TenantTransactions,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly setup: BillingSetupService,
    private readonly ledger: LedgerService,
    private readonly invoices: InvoicesService,
    private readonly people: PeopleService,
    private readonly schools: SchoolsService,
    private readonly gateway: PaymentGateway,
    private readonly notifications: NotificationsService,
    private readonly renderer: DocumentRenderer,
    private readonly audit: AuditService,
    private readonly clock: SchoolClock,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  // ── Offline payments (FEE-11/13/14) ─────────────────────────────────

  async record(dto: PaymentDto) {
    if (!(await this.people.familyNames([dto.familyId])).has(dto.familyId)) {
      throw problem(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'validation_failed',
        'familyId',
        'notFound',
      );
    }
    if (dto.invoiceId) {
      const invoice = await this.invoices.find(dto.invoiceId);
      if (invoice.familyId !== dto.familyId || invoice.status !== 'issued') {
        throw problem(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'validation_failed',
          'invoiceId',
          'notFound',
        );
      }
    }
    const { currency } = await this.setup.settingsRow();
    const payment = await this.createPayment({
      familyId: dto.familyId,
      amount: BigInt(dto.amount),
      currency,
      method: dto.method,
      reference: dto.reference || null,
      receivedOn: dto.receivedOn,
      providerPaymentId: null,
      invoiceId: dto.invoiceId,
    });
    return this.paymentView(payment.id);
  }

  /** A payment, spread over open invoices oldest first (or the chosen one), the rest kept as credit. */
  private async createPayment(input: {
    familyId: string;
    amount: bigint;
    currency: string;
    method: Payment['method'];
    reference: string | null;
    receivedOn: string;
    providerPaymentId: string | null;
    invoiceId?: string;
  }) {
    if (input.amount <= 0n)
      throw problem(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'validation_failed',
        'amount',
        'min',
      );
    const payment = await this.tx.save(
      this.tx.create(Payment, {
        familyId: input.familyId,
        amount: input.amount,
        currency: input.currency,
        method: input.method,
        reference: input.reference,
        receivedOn: input.receivedOn,
        receiptNumber: await this.ledger.nextNumber('receipt'),
        providerPaymentId: input.providerPaymentId,
        recordedBy: this.context.userId ?? null,
      }),
    );
    const { allocations } = allocatePayment(
      input.amount,
      await this.ledger.openInvoices(input.familyId),
      input.invoiceId,
    );
    if (allocations.length) {
      await this.tx.insert(
        PaymentAllocation,
        allocations.map((allocation) => ({
          id: uuidv7(),
          paymentId: payment.id,
          invoiceId: allocation.invoiceId,
          amount: allocation.amount,
        })),
      );
    }
    await this.audit.record({
      action: 'payment.recorded',
      entityType: 'payment',
      entityId: payment.id,
      after: {
        amount: input.amount.toString(),
        currency: input.currency,
        method: input.method,
        receipt: payment.receiptNumber,
      },
    });

    const accounts = await this.people.familyAccounts(input.familyId);
    const receipt = documentNumber('RCT', payment.receiptNumber);
    await this.notifications.deliver({
      userIds: accounts.map((account) => account.userId),
      type: 'payment.received',
      params: { receipt },
      link: '/billing',
      locales: new Map(
        accounts.map((account) => [account.userId, account.locale]),
      ),
      mail: (url, locale) => ({
        type: 'payment.received',
        url,
        params: {
          receipt,
          amount: formatMoney(
            input.amount,
            input.currency,
            locale === 'fr' ? 'fr' : 'en',
          ),
        },
      }),
    });
    return payment;
  }

  // ── Card payments (FEE-12) ──────────────────────────────────────────

  /** A hosted Stripe page for what the invoice still owes. Card data never reaches Darsi. */
  async checkout(invoiceId: string, idempotencyKey: string, locale: string) {
    const invoice = await this.invoices.find(invoiceId);
    await this.invoices.assertFamilyAccess(invoice.familyId);
    if (invoice.status !== 'issued')
      throw problem(HttpStatus.CONFLICT, 'invoice_not_issued');
    const balance = (await this.ledger.balances([invoiceId])).get(
      invoiceId,
    )!.balance;
    if (balance <= 0n) throw problem(HttpStatus.CONFLICT, 'invoice_paid');
    const settings = await this.setup.settingsRow();
    if (!settings.stripeAccountId)
      throw problem(HttpStatus.CONFLICT, 'payments_unavailable');
    const appUrl = this.config.get('APP_URL', { infer: true });
    return this.gateway.createCheckout({
      accountId: settings.stripeAccountId,
      schoolId: this.context.requireSchoolId(),
      invoiceId,
      amount: balance,
      currency: invoice.currency,
      description: documentNumber(settings.invoicePrefix, invoice.number!),
      successUrl: appLink(appUrl, locale, '/billing?paid=1'),
      cancelUrl: appLink(appUrl, locale, '/billing'),
      idempotencyKey: `checkout:${invoiceId}:${idempotencyKey}`,
    });
  }

  /**
   * The provider's signed webhook is the only thing that marks a card payment.
   * The event id is stored with the payment in one transaction, so a repeated
   * webhook is acknowledged and ignored.
   */
  async webhook(
    rawBody: Buffer,
    signature: string,
  ): Promise<{ received: true; duplicate?: boolean }> {
    const payment = this.gateway.verifyWebhook(rawBody, signature);
    if (!payment) return { received: true };
    try {
      await this.transactions.runInSchool(payment.schoolId, async () => {
        await this.tx.insert(PaymentProviderEvent, {
          id: uuidv7(),
          provider: 'stripe',
          eventId: payment.eventId,
          type: 'checkout.session.completed',
        });
        const invoice = await this.tx.findOneBy(Invoice, {
          id: payment.invoiceId,
        });
        if (!invoice) throw new NotFoundException();
        await this.createPayment({
          familyId: invoice.familyId,
          amount: payment.amount,
          currency: payment.currency,
          method: 'card',
          reference: payment.paymentId,
          receivedOn: await this.clock.today(),
          providerPaymentId: payment.paymentId,
          invoiceId: invoice.id,
        });
      });
    } catch (error) {
      // A unique violation means this event or payment was already recorded.
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      ) {
        return { received: true, duplicate: true };
      }
      throw error;
    }
    return { received: true };
  }

  async connectStripe(locale: string) {
    const settings = await this.setup.settingsRow();
    const returnUrl = appLink(
      this.config.get('APP_URL', { infer: true }),
      locale,
      '/billing/settings',
    );
    const link = await this.gateway.onboardingLink(
      settings.stripeAccountId,
      returnUrl,
    );
    await this.setup.connectStripe(link.accountId);
    return { url: link.url };
  }

  // ── Refunds (FEE-16) ────────────────────────────────────────────────

  /**
   * Gives money back against the original payment: first from what the family
   * holds as credit, then by reopening the invoices it paid, newest first.
   */
  async refund(paymentId: string, amount: bigint, reason: string) {
    const payment = await this.tx.findOneBy(Payment, { id: paymentId });
    if (!payment) throw new NotFoundException();
    const refunded = (await this.tx.findBy(Refund, { paymentId })).reduce(
      (total, entry) => total + entry.amount,
      0n,
    );
    if (amount <= 0n || amount > payment.amount - refunded)
      throw problem(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'validation_failed',
        'amount',
        'max',
      );

    const allocations = await this.tx.find(PaymentAllocation, {
      where: { paymentId },
      order: { createdAt: 'DESC' },
    });
    const netByInvoice = new Map<string, bigint>();
    for (const allocation of [...allocations].reverse()) {
      netByInvoice.set(
        allocation.invoiceId,
        (netByInvoice.get(allocation.invoiceId) ?? 0n) + allocation.amount,
      );
    }
    const allocated = [...netByInvoice.values()].reduce(
      (total, value) => total + value,
      0n,
    );
    const kept = payment.amount - allocated - refunded;
    let toReopen = amount > kept ? amount - kept : 0n;
    const reopenOrder = [
      ...new Set(allocations.map((allocation) => allocation.invoiceId)),
    ];
    for (const invoiceId of reopenOrder) {
      if (toReopen === 0n) break;
      const available = netByInvoice.get(invoiceId) ?? 0n;
      const share = available < toReopen ? available : toReopen;
      if (share <= 0n) continue;
      await this.tx.insert(PaymentAllocation, {
        id: uuidv7(),
        paymentId,
        invoiceId,
        amount: -share,
      });
      toReopen -= share;
    }

    const refundId = uuidv7();
    let providerRefundId: string | null = null;
    if (payment.method === 'card' && payment.providerPaymentId) {
      const settings = await this.setup.settingsRow();
      providerRefundId = (
        await this.gateway.refund(
          settings.stripeAccountId!,
          payment.providerPaymentId,
          amount,
          `refund:${refundId}`,
        )
      ).id;
    }
    await this.tx.insert(Refund, {
      id: refundId,
      paymentId,
      amount,
      reason,
      providerRefundId,
      refundedBy: this.context.requireUserId(),
    });
    await this.audit.record({
      action: 'payment.refunded',
      entityType: 'payment',
      entityId: paymentId,
      after: { amount: amount.toString(), reason },
    });
    return this.paymentView(paymentId);
  }

  // ── Reading ─────────────────────────────────────────────────────────

  async list(familyId?: string) {
    const families = await this.invoices.visibleFamilies();
    if (families && familyId && !families.includes(familyId))
      throw new ForbiddenException();
    const payments = await this.tx.find(Payment, {
      where: familyId
        ? { familyId }
        : families
          ? { familyId: In(families) }
          : {},
      order: { receivedOn: 'DESC', createdAt: 'DESC' },
      take: 500,
    });
    return Promise.all(payments.map((payment) => this.paymentView(payment.id)));
  }

  async paymentView(id: string) {
    const payment = await this.tx.findOneBy(Payment, { id });
    if (!payment) throw new NotFoundException();
    const [allocations, refunds, names, settings] = await Promise.all([
      this.tx.findBy(PaymentAllocation, { paymentId: id }),
      this.tx.findBy(Refund, { paymentId: id }),
      this.people.familyNames([payment.familyId]),
      this.setup.settingsRow(),
    ]);
    const invoices = allocations.length
      ? await this.tx.findBy(Invoice, {
          id: In([...new Set(allocations.map((a) => a.invoiceId))]),
        })
      : [];
    const byInvoice = new Map<string, bigint>();
    for (const allocation of allocations)
      byInvoice.set(
        allocation.invoiceId,
        (byInvoice.get(allocation.invoiceId) ?? 0n) + allocation.amount,
      );
    const refunded = refunds.reduce((total, entry) => total + entry.amount, 0n);
    const applied = [...byInvoice.values()].reduce(
      (total, value) => total + value,
      0n,
    );
    return {
      id: payment.id,
      familyId: payment.familyId,
      familyName: names.get(payment.familyId) ?? '',
      receipt: documentNumber('RCT', payment.receiptNumber),
      amount: minorString(payment.amount),
      currency: payment.currency,
      method: payment.method,
      reference: payment.reference,
      receivedOn: payment.receivedOn,
      allocations: [...byInvoice]
        .filter(([, amount]) => amount !== 0n)
        .map(([invoiceId, amount]) => {
          const invoice = invoices.find(
            (candidate) => candidate.id === invoiceId,
          )!;
          return {
            invoiceId,
            invoiceNumber: documentNumber(
              settings.invoicePrefix,
              invoice.number!,
            ),
            amount: minorString(amount),
          };
        }),
      refunded: minorString(refunded),
      credit: minorString(payment.amount - applied - refunded),
      refunds: refunds.map((entry) => ({
        id: entry.id,
        amount: minorString(entry.amount),
        reason: entry.reason,
        createdAt: entry.createdAt,
      })),
    };
  }

  /** A guardian's view of each family: what is owed, what was paid, credit held (FEE-10). */
  async statements() {
    const families = (await this.invoices.visibleFamilies()) ?? [];
    const names = await this.people.familyNames(families);
    return Promise.all(
      families.map(async (familyId) => {
        const invoices = await this.invoices.list({ familyId });
        return {
          familyId,
          familyName: names.get(familyId) ?? '',
          balance: minorString(
            invoices.reduce(
              (total, invoice) => total + BigInt(invoice.balance),
              0n,
            ),
          ),
          credit: minorString(await this.ledger.familyCredit(familyId)),
          invoices,
          payments: await this.list(familyId),
        };
      }),
    );
  }

  async receiptPdf(id: string, locale: 'en' | 'fr') {
    const view = await this.paymentView(id);
    await this.invoices.assertFamilyAccess(view.familyId);
    const school = await this.schools.getCurrent();
    const html = renderReceiptHtml({
      locale,
      schoolName: school.name,
      number: view.receipt,
      familyName: view.familyName,
      receivedOn: view.receivedOn,
      method: view.method,
      reference: view.reference,
      currency: view.currency,
      amount: BigInt(view.amount),
      allocations: view.allocations.map((entry) => ({
        invoiceNumber: entry.invoiceNumber,
        amount: BigInt(entry.amount),
      })),
      credit: BigInt(view.credit),
    });
    return {
      name: `${view.receipt}.pdf`,
      content: await this.renderer.pdf(html),
    };
  }
}
