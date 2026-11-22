import { InjectQueue } from '@nestjs/bullmq';
import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import type { Queue } from 'bullmq';
import { In } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { addDays, zonedTimeToUtc } from '../../common/dates/calendar-date.js';
import { ProblemException } from '../../common/errors/problem.exception.js';
import { RequestContext } from '../../common/tenancy/request-context.js';
import { TenantTransactions } from '../../common/tenancy/tenant-transactions.js';
import { AcademicsService } from '../academics/academics.service.js';
import { AuditService } from '../audit/audit.service.js';
import { rolesAllow } from '../auth/access-control.js';
import { CalendarService } from '../calendar/calendar.service.js';
import { DocumentRenderer } from '../documents/document-renderer.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PeopleService } from '../people/people.service.js';
import { SchoolClock } from '../schools/school-clock.service.js';
import { SchoolsService } from '../schools/schools.service.js';
import {
  documentNumber,
  formatMoney,
  renderInvoiceHtml,
} from './billing-documents.js';
import type {
  DraftInvoiceDto,
  InvoiceLineDto,
  RunPeriodDto,
} from './billing.dto.js';
import {
  CreditNote,
  Invoice,
  InvoiceLine,
  PaymentAllocation,
} from './billing.entities.js';
import { BillingSetupService, minorString } from './billing-setup.service.js';
import { LedgerService } from './ledger.service.js';
import {
  calculateInvoice,
  type DiscountInput,
  type FeeLineInput,
} from './money/fee-calculator.js';

export const BILLING_QUEUE = 'billing';

export interface ReminderJob {
  schoolId: string;
  invoiceId: string;
  /** Days before (negative) or after (positive) the due date. */
  offset: number;
}

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
export class InvoicesService implements OnModuleInit {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly context: RequestContext,
    private readonly transactions: TenantTransactions,
    private readonly setup: BillingSetupService,
    private readonly ledger: LedgerService,
    private readonly people: PeopleService,
    private readonly academics: AcademicsService,
    private readonly schools: SchoolsService,
    private readonly calendar: CalendarService,
    private readonly notifications: NotificationsService,
    private readonly renderer: DocumentRenderer,
    private readonly audit: AuditService,
    private readonly clock: SchoolClock,
    @InjectQueue(BILLING_QUEUE) private readonly queue: Queue<ReminderJob>,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  onModuleInit() {
    this.calendar.registerSource('billing', (from, to) =>
      this.dueDates(from, to),
    );
  }

  // ── Reading ─────────────────────────────────────────────────────────

  /** Finance staff see every family; a guardian sees only their own (FEE-10). */
  async list(filter: { familyId?: string; status?: Invoice['status'] } = {}) {
    const families = await this.visibleFamilies();
    if (families && filter.familyId && !families.includes(filter.familyId))
      throw new ForbiddenException();
    const invoices = await this.tx.find(Invoice, {
      where: {
        ...(filter.status
          ? { status: filter.status }
          : families
            ? { status: 'issued' }
            : {}),
        ...(filter.familyId
          ? { familyId: filter.familyId }
          : families
            ? { familyId: In(families) }
            : {}),
      },
      order: { createdAt: 'DESC' },
      take: 500,
    });
    return this.summaries(invoices);
  }

  async get(id: string) {
    const invoice = await this.find(id);
    await this.assertFamilyAccess(invoice.familyId, invoice.status === 'draft');
    const [lines, credits, allocations, [summary]] = await Promise.all([
      this.tx.find(InvoiceLine, {
        where: { invoiceId: id },
        order: { sortOrder: 'ASC' },
      }),
      this.tx.find(CreditNote, {
        where: { invoiceId: id },
        order: { createdAt: 'ASC' },
      }),
      this.tx.find(PaymentAllocation, {
        where: { invoiceId: id },
        order: { createdAt: 'ASC' },
      }),
      this.summaries([invoice]),
    ]);
    const students = await this.people.studentsByIds([
      ...new Set(
        lines.flatMap((line) => (line.studentId ? [line.studentId] : [])),
      ),
    ]);
    const settings = await this.setup.settingsRow();
    return {
      ...summary,
      notes: invoice.notes,
      lines: lines.map((line) => {
        const student = students.find(
          (candidate) => candidate.id === line.studentId,
        );
        return {
          id: line.id,
          student: student
            ? {
                id: student.id,
                name: `${student.preferredName ?? student.firstName} ${student.lastName}`,
              }
            : null,
          feeItemId: line.feeItemId,
          description: line.description,
          quantity: line.quantity,
          unitAmount: minorString(line.unitAmount),
          discount: minorString(line.discount),
          taxRateBp: line.taxRateBp,
          tax: minorString(line.tax),
          total: minorString(line.total),
        };
      }),
      creditNotes: credits.map((credit) => ({
        id: credit.id,
        number: documentNumber('CN', credit.number),
        amount: minorString(credit.amount),
        reason: credit.reason,
        createdAt: credit.createdAt,
      })),
      allocations: allocations.map((allocation) => ({
        paymentId: allocation.paymentId,
        amount: minorString(allocation.amount),
        createdAt: allocation.createdAt,
      })),
      prefix: settings.invoicePrefix,
    };
  }

  // ── Drafts (FEE-6) ──────────────────────────────────────────────────

  async createDraft(dto: DraftInvoiceDto) {
    if (!(await this.people.familyNames([dto.familyId])).has(dto.familyId))
      throw problem(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'validation_failed',
        'familyId',
        'notFound',
      );
    const { currency } = await this.setup.settingsRow();
    const invoice = await this.tx.save(
      this.tx.create(Invoice, {
        familyId: dto.familyId,
        status: 'draft',
        currency,
        notes: dto.notes || null,
        subtotal: 0n,
        discountTotal: 0n,
        taxTotal: 0n,
        total: 0n,
        createdBy: this.context.requireUserId(),
      }),
    );
    await this.writeLines(invoice, dto.lines, []);
    return this.get(invoice.id);
  }

  async updateDraft(id: string, dto: DraftInvoiceDto) {
    const invoice = await this.find(id);
    if (invoice.status !== 'draft')
      throw problem(HttpStatus.CONFLICT, 'invoice_issued');
    invoice.notes = dto.notes || null;
    await this.tx.delete(InvoiceLine, { invoiceId: id });
    await this.writeLines(invoice, dto.lines, []);
    return this.get(id);
  }

  async deleteDraft(id: string) {
    const invoice = await this.find(id);
    if (invoice.status !== 'draft')
      throw problem(HttpStatus.CONFLICT, 'invoice_issued');
    await this.tx.delete(Invoice, { id });
  }

  // ── Issuing ─────────────────────────────────────────────────────────

  /**
   * Gives the draft its gap-free number and dates and freezes it (a trigger
   * refuses later changes). Family credit is applied straight away.
   */
  async issue(id: string, dueDate?: string) {
    const invoice = await this.find(id);
    if (invoice.status !== 'draft')
      throw problem(HttpStatus.CONFLICT, 'invoice_issued');
    if (!(await this.tx.existsBy(InvoiceLine, { invoiceId: id })))
      throw problem(HttpStatus.UNPROCESSABLE_ENTITY, 'invoice_empty');
    await this.issueDraft(invoice, dueDate);
    return this.get(id);
  }

  private async issueDraft(invoice: Invoice, dueDate?: string) {
    const settings = await this.setup.settingsRow();
    const today = await this.clock.today();
    Object.assign(invoice, {
      status: 'issued',
      number: await this.ledger.nextNumber('invoice'),
      issueDate: today,
      dueDate: dueDate ?? addDays(today, settings.paymentTermsDays),
      issuedBy: this.context.userId ?? null,
    });
    await this.tx.save(invoice);
    await this.applyCredit(invoice);
    await this.audit.record({
      action: 'invoice.issued',
      entityType: 'invoice',
      entityId: invoice.id,
      after: {
        number: invoice.number,
        total: invoice.total.toString(),
        currency: invoice.currency,
      },
    });
    await this.scheduleReminders(
      invoice,
      settings.reminderDaysBefore,
      settings.reminderDaysAfter,
    );
  }

  /** Overpayments the family already made settle new invoices first (FEE-13). */
  private async applyCredit(invoice: Invoice) {
    let owed = invoice.total;
    for (const credit of await this.ledger.unappliedByPayment(
      invoice.familyId,
    )) {
      if (owed === 0n) break;
      const amount = credit.amount < owed ? credit.amount : owed;
      await this.tx.save(
        this.tx.create(PaymentAllocation, {
          paymentId: credit.paymentId,
          invoiceId: invoice.id,
          amount,
        }),
      );
      owed -= amount;
    }
  }

  /** The only way to lower an issued invoice (FEE-8). It never takes the balance below zero. */
  async creditNote(id: string, amount: bigint, reason: string) {
    const invoice = await this.find(id);
    if (invoice.status !== 'issued')
      throw problem(HttpStatus.CONFLICT, 'invoice_not_issued');
    const balance = (await this.ledger.balances([id])).get(id)!.balance;
    if (amount <= 0n || amount > balance)
      throw problem(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'validation_failed',
        'amount',
        'max',
      );
    const note = await this.tx.save(
      this.tx.create(CreditNote, {
        invoiceId: id,
        number: await this.ledger.nextNumber('credit_note'),
        amount,
        currency: invoice.currency,
        reason,
        issuedBy: this.context.requireUserId(),
      }),
    );
    await this.audit.record({
      action: 'invoice.credited',
      entityType: 'invoice',
      entityId: id,
      after: { creditNote: note.number, amount: amount.toString(), reason },
    });
    return this.get(id);
  }

  /** A one-line invoice issued straight away, for admissions fees and deposits (ADMS-10, ADMS-12). */
  async issueCharge(input: {
    familyId: string;
    description: string;
    amount: bigint;
    taxRateBp?: number;
    feeItemId?: string | null;
    studentId?: string | null;
    reference: string;
  }): Promise<string> {
    const { currency } = await this.setup.settingsRow();
    const invoice = await this.tx.save(
      this.tx.create(Invoice, {
        familyId: input.familyId,
        status: 'draft',
        currency,
        reference: input.reference,
        notes: null,
        subtotal: 0n,
        discountTotal: 0n,
        taxTotal: 0n,
        total: 0n,
        createdBy: this.context.userId ?? null,
      }),
    );
    await this.writeLines(
      invoice,
      [
        {
          description: input.description,
          quantity: 1,
          unitAmount: input.amount.toString(),
          taxRateBp: input.taxRateBp ?? 0,
          feeItemId: input.feeItemId ?? undefined,
          studentId: input.studentId ?? undefined,
        },
      ],
      [],
    );
    await this.issueDraft(invoice);
    return invoice.id;
  }

  // ── Bulk runs (FEE-5) ───────────────────────────────────────────────

  /** What a run would issue: one invoice per family, skipping families already invoiced for the period. */
  async preview(dto: RunPeriodDto) {
    const plan = await this.plan(dto);
    return {
      periodKey: plan.periodKey,
      families: plan.families.map((family) => ({
        familyId: family.familyId,
        familyName: family.familyName,
        students: family.students.length,
        total: minorString(family.calculated.total),
        alreadyInvoiced: family.alreadyInvoiced,
      })),
      withoutFamily: plan.withoutFamily,
      total: minorString(
        plan.families
          .filter((family) => !family.alreadyInvoiced)
          .reduce((sum, family) => sum + family.calculated.total, 0n),
      ),
    };
  }

  /** Issues the run in one transaction; running it again for the same period creates nothing new. */
  async run(dto: RunPeriodDto) {
    const plan = await this.plan(dto);
    let issued = 0;
    for (const family of plan.families.filter(
      (entry) => !entry.alreadyInvoiced && entry.calculated.lines.length > 0,
    )) {
      const invoice = await this.tx.save(
        this.tx.create(Invoice, {
          familyId: family.familyId,
          status: 'draft',
          periodKey: plan.periodKey,
          reference: plan.label,
          currency: plan.currency,
          subtotal: family.calculated.subtotal,
          discountTotal: family.calculated.discountTotal,
          taxTotal: family.calculated.taxTotal,
          total: family.calculated.total,
          notes: null,
          createdBy: this.context.requireUserId(),
        }),
      );
      await this.tx.insert(
        InvoiceLine,
        family.calculated.lines.map((line, index) => ({
          id: uuidv7(),
          invoiceId: invoice.id,
          studentId: line.studentId,
          feeItemId: line.feeItemId,
          description: line.description,
          quantity: line.quantity,
          unitAmount: line.unitAmount,
          discount: line.discount,
          taxRateBp: line.taxRateBp,
          tax: line.tax,
          total: line.total,
          sortOrder: index,
        })),
      );
      await this.issueDraft(invoice, dto.dueDate);
      issued += 1;
    }
    await this.audit.record({
      action: 'invoice.run',
      entityType: 'billing_run',
      after: { periodKey: plan.periodKey, issued },
    });
    return {
      periodKey: plan.periodKey,
      issued,
      skipped: plan.families.length - issued,
      withoutFamily: plan.withoutFamily,
    };
  }

  private async plan(dto: RunPeriodDto) {
    const settings = await this.setup.settingsRow();
    const year = await this.academics.findYear(dto.academicYearId);
    let periodKey: string;
    let label: string;
    if (dto.schedule === 'term') {
      if (!dto.termId)
        throw problem(
          HttpStatus.BAD_REQUEST,
          'validation_failed',
          'termId',
          'required',
        );
      const term = await this.academics.findTerm(dto.termId);
      if (term.academicYearId !== year.id)
        throw problem(
          HttpStatus.BAD_REQUEST,
          'validation_failed',
          'termId',
          'notFound',
        );
      periodKey = `term:${term.id}`;
      label = term.name;
    } else if (dto.schedule === 'monthly') {
      if (!dto.month)
        throw problem(
          HttpStatus.BAD_REQUEST,
          'validation_failed',
          'month',
          'required',
        );
      periodKey = `month:${year.id}:${dto.month}`;
      label = dto.month;
    } else {
      periodKey = `year:${year.id}`;
      label = year.name;
    }

    const inputs = await this.setup.runInputs(year.id);
    const structures = inputs.structures.filter(
      (structure) => structure.schedule === dto.schedule,
    );
    const students = await this.people.billableStudents();
    const byFamily = new Map<
      string,
      {
        students: typeof students;
        lines: FeeLineInput[];
        discounts: DiscountInput[];
      }
    >();
    const withoutFamily: string[] = [];

    for (const student of students) {
      const structure =
        structures.find(
          (candidate) => candidate.gradeLevelId === student.gradeLevelId,
        ) ?? structures.find((candidate) => candidate.gradeLevelId === null);
      if (!structure) continue;
      if (!student.familyId) {
        withoutFamily.push(student.name);
        continue;
      }
      const family = byFamily.get(student.familyId) ?? {
        students: [],
        lines: [],
        discounts: [],
      };
      family.students.push(student);
      for (const line of inputs.lines.filter(
        (entry) => entry.structureId === structure.id,
      )) {
        const item = inputs.items.find(
          (candidate) => candidate.id === line.feeItemId,
        )!;
        family.lines.push({
          key: `${student.id}:${item.id}`,
          studentId: student.id,
          feeItemId: item.id,
          description: `${item.name} – ${label}`,
          quantity: 1,
          unitAmount: line.amount,
          taxRateBp: item.taxRateBp,
        });
      }
      for (const assigned of inputs.assigned.filter(
        (entry) => entry.studentId === student.id,
      )) {
        const discount = inputs.discounts.find(
          (candidate) => candidate.id === assigned.discountId,
        )!;
        family.discounts.push({
          label: discount.name,
          studentId: student.id,
          kind: discount.kind,
          value: discount.value,
          feeItemIds: discount.feeItemIds,
        });
      }
      byFamily.set(student.familyId, family);
    }

    const familyIds = [...byFamily.keys()];
    const [names, existing] = await Promise.all([
      this.people.familyNames(familyIds),
      familyIds.length
        ? this.tx.findBy(Invoice, { familyId: In(familyIds), periodKey })
        : [],
    ]);
    return {
      periodKey,
      label,
      currency: settings.currency,
      withoutFamily,
      families: familyIds.map((familyId) => {
        const family = byFamily.get(familyId)!;
        return {
          familyId,
          familyName: names.get(familyId) ?? '',
          students: family.students,
          alreadyInvoiced: existing.some(
            (invoice) => invoice.familyId === familyId,
          ),
          calculated: calculateInvoice(
            settings.currency,
            family.lines,
            family.discounts,
            settings.rounding,
          ),
        };
      }),
    };
  }

  // ── Reminders (FEE-15) ──────────────────────────────────────────────

  /** One delayed job per reminder, at 8:00 in the school's time zone. */
  private async scheduleReminders(
    invoice: Invoice,
    before: number[],
    after: number[],
  ) {
    const timeZone = await this.clock.timeZone();
    const now = Date.now();
    const offsets = [...before.map((days) => -days), ...after];
    for (const offset of offsets) {
      const at = zonedTimeToUtc(
        `${addDays(invoice.dueDate!, offset)}T08:00`,
        timeZone,
      ).getTime();
      if (at <= now) continue;
      await this.queue.add(
        'reminder',
        {
          schoolId: this.context.requireSchoolId(),
          invoiceId: invoice.id,
          offset,
        },
        { delay: at - now, jobId: `reminder-${invoice.id}-${offset}` },
      );
    }
  }

  /** Runs in the worker. Nothing is sent once the invoice is settled. */
  async remind({ schoolId, invoiceId, offset }: ReminderJob): Promise<boolean> {
    return this.transactions.runInSchool(schoolId, async () => {
      const invoice = await this.tx.findOneBy(Invoice, { id: invoiceId });
      if (!invoice || invoice.status !== 'issued') return false;
      const balance = (await this.ledger.balances([invoiceId])).get(
        invoiceId,
      )!.balance;
      if (balance <= 0n) return false;
      const settings = await this.setup.settingsRow();
      const number = documentNumber(settings.invoicePrefix, invoice.number!);
      const accounts = await this.people.familyAccounts(invoice.familyId);
      await this.notifications.deliver({
        userIds: accounts.map((account) => account.userId),
        type: 'invoice.reminder',
        params: { number, stage: offset > 0 ? 'overdue' : 'due' },
        link: '/billing',
        locales: new Map(
          accounts.map((account) => [account.userId, account.locale]),
        ),
        mail: (url, locale) => ({
          type: 'invoice.reminder',
          url,
          params: {
            number,
            amount: formatMoney(
              balance,
              invoice.currency,
              locale === 'fr' ? 'fr' : 'en',
            ),
            dueDate: new Intl.DateTimeFormat(
              locale === 'fr' ? 'fr-FR' : 'en-GB',
              { dateStyle: 'long', timeZone: 'UTC' },
            ).format(new Date(`${invoice.dueDate}T00:00:00Z`)),
            overdue: offset > 0,
          },
        }),
      });
      return true;
    });
  }

  // ── Documents ───────────────────────────────────────────────────────

  async pdf(
    id: string,
    locale: 'en' | 'fr',
  ): Promise<{ name: string; content: Buffer }> {
    const detail = await this.get(id);
    if (detail.status !== 'issued')
      throw problem(HttpStatus.CONFLICT, 'invoice_not_issued');
    const school = await this.schools.getCurrent();
    const html = renderInvoiceHtml({
      locale,
      schoolName: school.name,
      number: detail.number!,
      familyName: detail.familyName,
      issueDate: detail.issueDate!,
      dueDate: detail.dueDate!,
      currency: detail.currency,
      lines: detail.lines.map((line) => ({
        description: line.description,
        student: line.student?.name ?? null,
        quantity: line.quantity,
        unitAmount: BigInt(line.unitAmount),
        discount: BigInt(line.discount),
        tax: BigInt(line.tax),
        total: BigInt(line.total),
      })),
      subtotal: BigInt(detail.subtotal),
      discountTotal: BigInt(detail.discountTotal),
      taxTotal: BigInt(detail.taxTotal),
      total: BigInt(detail.total),
      credits: detail.creditNotes.map((credit) => ({
        number: credit.number,
        amount: BigInt(credit.amount),
        reason: credit.reason,
      })),
      paid: BigInt(detail.paid),
      balance: BigInt(detail.balance),
    });
    return {
      name: `${detail.number}.pdf`,
      content: await this.renderer.pdf(html),
    };
  }

  // ── Calendar (CAL-6) ────────────────────────────────────────────────

  /** Due dates of what a guardian's family still owes. Staff calendars never show fees. */
  private async dueDates(from: string, to: string) {
    const userId = this.context.userId;
    if (!userId || !rolesAllow(this.context.roles, { invoice: ['read'] }))
      return [];
    const families = await this.people.familyIdsForUser(userId);
    if (families.length === 0) return [];
    const invoices = (
      await this.tx.findBy(Invoice, {
        familyId: In(families),
        status: 'issued',
      })
    ).filter((invoice) => invoice.dueDate! >= from && invoice.dueDate! <= to);
    const balances = await this.ledger.balances(
      invoices.map((invoice) => invoice.id),
    );
    const settings = await this.setup.settingsRow();
    return invoices
      .filter((invoice) => balances.get(invoice.id)!.balance > 0n)
      .map((invoice) => ({
        id: invoice.id,
        source: 'billing',
        kind: 'payment_due',
        title: documentNumber(settings.invoicePrefix, invoice.number!),
        description: null,
        startsOn: invoice.dueDate!,
        endsOn: invoice.dueDate!,
        startTime: null,
        endTime: null,
        link: '/billing',
      }));
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  /** Families the user may see, or null for finance staff who see all. */
  async visibleFamilies(): Promise<string[] | null> {
    if (rolesAllow(this.context.roles, { fee: ['read'] })) return null;
    if (!rolesAllow(this.context.roles, { invoice: ['read'] }))
      throw new ForbiddenException();
    return this.people.familyIdsForUser(this.context.requireUserId());
  }

  async assertFamilyAccess(familyId: string, staffOnly = false) {
    const families = await this.visibleFamilies();
    if (families === null) return;
    if (staffOnly || !families.includes(familyId))
      throw new ForbiddenException();
  }

  async summaries(invoices: Invoice[]) {
    const [balances, names, settings] = await Promise.all([
      this.ledger.balances(
        invoices
          .filter((invoice) => invoice.status === 'issued')
          .map((invoice) => invoice.id),
      ),
      this.people.familyNames(invoices.map((invoice) => invoice.familyId)),
      this.setup.settingsRow(),
    ]);
    const today = await this.clock.today();
    return invoices.map((invoice) => {
      const balance = balances.get(invoice.id);
      return {
        id: invoice.id,
        status: invoice.status,
        number: invoice.number
          ? documentNumber(settings.invoicePrefix, invoice.number)
          : null,
        reference: invoice.reference,
        familyId: invoice.familyId,
        familyName: names.get(invoice.familyId) ?? '',
        currency: invoice.currency,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        subtotal: minorString(invoice.subtotal),
        discountTotal: minorString(invoice.discountTotal),
        taxTotal: minorString(invoice.taxTotal),
        total: minorString(invoice.total),
        credited: minorString(balance?.credited ?? 0n),
        paid: minorString(balance?.paid ?? 0n),
        balance: minorString(balance?.balance ?? invoice.total),
        state:
          invoice.status === 'draft'
            ? 'draft'
            : balance!.balance <= 0n
              ? 'paid'
              : balance!.paid > 0n
                ? 'partially_paid'
                : invoice.dueDate! < today
                  ? 'overdue'
                  : 'open',
      };
    });
  }

  private async writeLines(
    invoice: Invoice,
    lines: InvoiceLineDto[],
    discounts: DiscountInput[],
  ) {
    const settings = await this.setup.settingsRow();
    const calculated = calculateInvoice(
      invoice.currency,
      lines.map((line, index) => ({
        key: String(index),
        studentId: line.studentId ?? null,
        feeItemId: line.feeItemId ?? null,
        description: line.description,
        quantity: line.quantity,
        unitAmount: BigInt(line.unitAmount),
        taxRateBp: line.taxRateBp,
      })),
      discounts,
      settings.rounding,
    );
    Object.assign(invoice, {
      subtotal: calculated.subtotal,
      discountTotal: calculated.discountTotal,
      taxTotal: calculated.taxTotal,
      total: calculated.total,
    });
    await this.tx.save(invoice);
    if (calculated.lines.length) {
      await this.tx.insert(
        InvoiceLine,
        calculated.lines.map((line, index) => ({
          id: uuidv7(),
          invoiceId: invoice.id,
          studentId: line.studentId,
          feeItemId: line.feeItemId,
          description: line.description,
          quantity: line.quantity,
          unitAmount: line.unitAmount,
          discount: line.discount,
          taxRateBp: line.taxRateBp,
          tax: line.tax,
          total: line.total,
          sortOrder: index,
        })),
      );
    }
  }

  async find(id: string): Promise<Invoice> {
    const invoice = await this.tx.findOneBy(Invoice, { id });
    if (!invoice) throw new NotFoundException();
    return invoice;
  }
}
