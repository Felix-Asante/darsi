import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../common/entities/tenant.entity.js';
import type { RoundingMode } from './money/money.js';

/** Postgres returns bigint as text; money stays bigint end to end, never a float. */
const minorUnits = {
  to: (value: bigint | null | undefined) =>
    value === null || value === undefined ? value : value.toString(),
  from: (value: string | null) => (value === null ? null : BigInt(value)),
};
const money = { type: 'bigint' as const, transformer: minorUnits };

@Entity('billing_settings')
export class BillingSettings extends TenantEntity {
  @Column('text')
  rounding: RoundingMode;

  @Column('text')
  invoicePrefix: string;

  @Column('integer')
  paymentTermsDays: number;

  @Column('integer', { array: true })
  reminderDaysBefore: number[];

  @Column('integer', { array: true })
  reminderDaysAfter: number[];

  /** The school's own Stripe account (Connect Standard); money goes straight to it. */
  @Column('text', { nullable: true })
  stripeAccountId: string | null;
}

export const FEE_KINDS = [
  'tuition',
  'registration',
  'application',
  'deposit',
  'uniform',
  'trip',
  'other',
] as const;
export type FeeKind = (typeof FEE_KINDS)[number];

@Entity('fee_items')
export class FeeItem extends TenantEntity {
  @Column('text')
  name: string;

  @Column('text')
  kind: FeeKind;

  @Column(money)
  amount: bigint;

  @Column('char', { length: 3 })
  currency: string;

  @Column('integer')
  taxRateBp: number;

  @Column('text', { nullable: true })
  accountingCode: string | null;

  @Column('boolean')
  active: boolean;
}

export const SCHEDULES = ['annual', 'term', 'monthly'] as const;
export type Schedule = (typeof SCHEDULES)[number];

/** What a grade pays in a year, and how often it is billed (FEE-3). */
@Entity('fee_structures')
export class FeeStructure extends TenantEntity {
  @Column('uuid')
  academicYearId: string;

  @Column('uuid', { nullable: true })
  gradeLevelId: string | null;

  @Column('text')
  name: string;

  @Column('text')
  schedule: Schedule;
}

/** An item in a structure, with the amount charged each billing period. */
@Entity('fee_structure_lines')
export class FeeStructureLine extends TenantEntity {
  @Column('uuid')
  structureId: string;

  @Column('uuid')
  feeItemId: string;

  @Column(money)
  amount: bigint;
}

@Entity('discounts')
export class Discount extends TenantEntity {
  @Column('text')
  name: string;

  @Column('text')
  kind: 'percent' | 'fixed';

  /** Basis points for percentages, minor units for fixed amounts. */
  @Column(money)
  value: bigint;

  @Column('uuid', { array: true })
  feeItemIds: string[];
}

@Entity('student_discounts')
export class StudentDiscount extends TenantEntity {
  @Column('uuid')
  studentId: string;

  @Column('uuid')
  discountId: string;
}

/** Gap-free numbering per school, taken under a row lock in the issuing transaction (FEE-7). */
@Entity('document_sequences')
export class DocumentSequence extends TenantEntity {
  @Column('text')
  kind: 'invoice' | 'credit_note' | 'receipt';

  @Column('integer')
  nextNumber: number;
}

export type InvoiceStatus = 'draft' | 'issued';

/** Billed to a family, covering any of its children (FEE-9). Immutable once issued (FEE-8). */
@Entity('invoices')
export class Invoice extends TenantEntity {
  @Column('uuid')
  familyId: string;

  @Column('text')
  status: InvoiceStatus;

  @Column('integer', { nullable: true })
  number: number | null;

  @Column('text', { nullable: true })
  reference: string | null;

  /** Set by bulk runs, so a period is never invoiced twice (FEE-5). */
  @Column('text', { nullable: true })
  periodKey: string | null;

  @Column('char', { length: 3 })
  currency: string;

  @Column('date', { nullable: true })
  issueDate: string | null;

  @Column('date', { nullable: true })
  dueDate: string | null;

  @Column(money)
  subtotal: bigint;

  @Column(money)
  discountTotal: bigint;

  @Column(money)
  taxTotal: bigint;

  @Column(money)
  total: bigint;

  @Column('text', { nullable: true })
  notes: string | null;

  @Column('uuid', { nullable: true })
  createdBy: string | null;

  @Column('uuid', { nullable: true })
  issuedBy: string | null;
}

@Entity('invoice_lines')
export class InvoiceLine extends TenantEntity {
  @Column('uuid')
  invoiceId: string;

  @Column('uuid', { nullable: true })
  studentId: string | null;

  @Column('uuid', { nullable: true })
  feeItemId: string | null;

  @Column('text')
  description: string;

  @Column('integer')
  quantity: number;

  @Column(money)
  unitAmount: bigint;

  @Column(money)
  discount: bigint;

  @Column('integer')
  taxRateBp: number;

  @Column(money)
  tax: bigint;

  @Column(money)
  total: bigint;

  @Column('integer')
  sortOrder: number;
}

/** The only way to reduce what an issued invoice asks for (FEE-8). */
@Entity('credit_notes')
export class CreditNote extends TenantEntity {
  @Column('uuid')
  invoiceId: string;

  @Column('integer')
  number: number;

  @Column(money)
  amount: bigint;

  @Column('char', { length: 3 })
  currency: string;

  @Column('text')
  reason: string;

  @Column('uuid', { nullable: true })
  issuedBy: string | null;
}

export const PAYMENT_METHODS = ['cash', 'transfer', 'cheque', 'card'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

@Entity('payments')
export class Payment extends TenantEntity {
  @Column('uuid')
  familyId: string;

  @Column(money)
  amount: bigint;

  @Column('char', { length: 3 })
  currency: string;

  @Column('text')
  method: PaymentMethod;

  @Column('text', { nullable: true })
  reference: string | null;

  @Column('date')
  receivedOn: string;

  @Column('integer')
  receiptNumber: number;

  /** The provider's payment id; unique, so one card payment is never recorded twice. */
  @Column('text', { nullable: true })
  providerPaymentId: string | null;

  @Column('uuid', { nullable: true })
  recordedBy: string | null;
}

/** Positive when money is applied to an invoice; negative when a refund takes it back. */
@Entity('payment_allocations')
export class PaymentAllocation extends TenantEntity {
  @Column('uuid')
  paymentId: string;

  @Column('uuid')
  invoiceId: string;

  @Column(money)
  amount: bigint;
}

@Entity('refunds')
export class Refund extends TenantEntity {
  @Column('uuid')
  paymentId: string;

  @Column(money)
  amount: bigint;

  @Column('text')
  reason: string;

  @Column('text', { nullable: true })
  providerRefundId: string | null;

  @Column('uuid', { nullable: true })
  refundedBy: string | null;
}

/** Each provider event once: a repeated webhook is acknowledged and ignored (FEE-12). */
@Entity('payment_provider_events')
export class PaymentProviderEvent extends TenantEntity {
  @Column('text')
  provider: string;

  @Column('text')
  eventId: string;

  @Column('text')
  type: string;
}
