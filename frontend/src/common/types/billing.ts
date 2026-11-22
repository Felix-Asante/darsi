/** Amounts are strings of minor units ("918300"), formatted with `formatMoney`; never parsed as floats. */
export type Minor = string;

export type InvoiceState =
  "draft" | "open" | "partially_paid" | "paid" | "overdue";

export interface InvoiceSummary {
  id: string;
  status: "draft" | "issued";
  number: string | null;
  reference: string | null;
  familyId: string;
  familyName: string;
  currency: string;
  issueDate: string | null;
  dueDate: string | null;
  subtotal: Minor;
  discountTotal: Minor;
  taxTotal: Minor;
  total: Minor;
  credited: Minor;
  paid: Minor;
  balance: Minor;
  state: InvoiceState;
}

export interface InvoiceDetail extends InvoiceSummary {
  notes: string | null;
  lines: {
    id: string;
    student: { id: string; name: string } | null;
    feeItemId: string | null;
    description: string;
    quantity: number;
    unitAmount: Minor;
    discount: Minor;
    taxRateBp: number;
    tax: Minor;
    total: Minor;
  }[];
  creditNotes: {
    id: string;
    number: string;
    amount: Minor;
    reason: string;
    createdAt: string;
  }[];
  allocations: { paymentId: string; amount: Minor; createdAt: string }[];
}

export type PaymentMethod = "cash" | "transfer" | "cheque" | "card";

export interface PaymentView {
  id: string;
  familyId: string;
  familyName: string;
  receipt: string;
  amount: Minor;
  currency: string;
  method: PaymentMethod;
  reference: string | null;
  receivedOn: string;
  allocations: { invoiceId: string; invoiceNumber: string; amount: Minor }[];
  refunded: Minor;
  credit: Minor;
  refunds: { id: string; amount: Minor; reason: string; createdAt: string }[];
}

export interface FamilyStatement {
  familyId: string;
  familyName: string;
  balance: Minor;
  credit: Minor;
  invoices: InvoiceSummary[];
  payments: PaymentView[];
}

export interface FamilyAccount {
  familyId: string;
  familyName: string;
  balance: Minor;
  credit: Minor;
}

export interface BillingSettings {
  currency: string;
  rounding: "half_up" | "half_even";
  invoicePrefix: string;
  paymentTermsDays: number;
  reminderDaysBefore: number[];
  reminderDaysAfter: number[];
  stripeConnected: boolean;
}

export type FeeKind =
  | "tuition"
  | "registration"
  | "application"
  | "deposit"
  | "uniform"
  | "trip"
  | "other";

export interface FeeItem {
  id: string;
  name: string;
  kind: FeeKind;
  amount: Minor;
  currency: string;
  taxRateBp: number;
  accountingCode: string | null;
  active: boolean;
}

export interface FeeStructure {
  id: string;
  academicYearId: string;
  gradeLevelId: string | null;
  name: string;
  schedule: "annual" | "term" | "monthly";
  lines: { feeItemId: string; amount: Minor }[];
}

export interface Discount {
  id: string;
  name: string;
  kind: "percent" | "fixed";
  value: Minor;
  feeItemIds: string[];
  studentIds: string[];
}

export interface RunPeriod {
  academicYearId: string;
  schedule: "annual" | "term" | "monthly";
  termId?: string;
  month?: string;
  dueDate?: string;
}

export interface RunPreview {
  periodKey: string;
  families: {
    familyId: string;
    familyName: string;
    students: number;
    total: Minor;
    alreadyInvoiced: boolean;
  }[];
  withoutFamily: string[];
  total: Minor;
}

export type AgingBucket = "current" | "0_30" | "31_60" | "61_90" | "90_plus";

export interface OutstandingReport {
  currency: string;
  totals: Record<AgingBucket | "total", Minor>;
  families: {
    familyId: string;
    familyName: string;
    gradeLevelIds: string[];
    total: Minor;
    buckets: Record<AgingBucket, Minor>;
  }[];
}
