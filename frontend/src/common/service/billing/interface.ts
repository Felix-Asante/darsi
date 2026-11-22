import type { ApiResponse } from "@/common/types/api";
import type {
  BillingSettings,
  Discount,
  FamilyAccount,
  FamilyStatement,
  FeeItem,
  FeeStructure,
  InvoiceDetail,
  InvoiceSummary,
  OutstandingReport,
  PaymentView,
  RunPeriod,
  RunPreview,
} from "@/common/types/billing";
import type { RequestConfig } from "../http.service";

type LineInput = {
  studentId?: string | null;
  feeItemId?: string | null;
  description: string;
  quantity: number;
  unitAmount: string;
  taxRateBp: number;
};

export interface IBillingService {
  settings: (config?: RequestConfig) => ApiResponse<BillingSettings>;
  saveSettings: (
    input: Omit<BillingSettings, "currency" | "stripeConnected">,
  ) => ApiResponse<BillingSettings>;
  connectStripe: (locale: string) => ApiResponse<{ url: string }>;
  feeItems: (config?: RequestConfig) => ApiResponse<FeeItem[]>;
  saveFeeItem: (
    input: Omit<FeeItem, "id" | "currency">,
    id?: string,
  ) => ApiResponse<FeeItem>;
  structures: (
    academicYearId: string,
    config?: RequestConfig,
  ) => ApiResponse<FeeStructure[]>;
  saveStructure: (input: Omit<FeeStructure, "id">) => ApiResponse<FeeStructure>;
  discounts: (config?: RequestConfig) => ApiResponse<Discount[]>;
  saveDiscount: (
    input: Omit<Discount, "id" | "studentIds">,
    id?: string,
  ) => ApiResponse<Discount>;
  setStudentDiscounts: (
    studentId: string,
    discountIds: string[],
  ) => ApiResponse<void>;

  invoices: (
    query?: { familyId?: string; status?: "draft" | "issued" },
    config?: RequestConfig,
  ) => ApiResponse<InvoiceSummary[]>;
  invoice: (id: string, config?: RequestConfig) => ApiResponse<InvoiceDetail>;
  createDraft: (input: {
    familyId: string;
    notes?: string | null;
    lines: LineInput[];
  }) => ApiResponse<InvoiceDetail>;
  issue: (id: string, dueDate?: string) => ApiResponse<InvoiceDetail>;
  deleteDraft: (id: string) => ApiResponse<void>;
  creditNote: (
    id: string,
    input: { amount: string; reason: string },
  ) => ApiResponse<InvoiceDetail>;
  checkout: (
    id: string,
    idempotencyKey: string,
    locale: string,
  ) => ApiResponse<{ url: string }>;
  pdf: (
    path: "invoice" | "receipt",
    id: string,
    locale: string,
  ) => ApiResponse<Blob>;
  previewRun: (period: RunPeriod) => ApiResponse<RunPreview>;
  run: (period: RunPeriod) => ApiResponse<{
    periodKey: string;
    issued: number;
    skipped: number;
    withoutFamily: string[];
  }>;

  payments: (
    familyId?: string,
    config?: RequestConfig,
  ) => ApiResponse<PaymentView[]>;
  recordPayment: (input: {
    familyId: string;
    amount: string;
    method: "cash" | "transfer" | "cheque";
    reference?: string | null;
    receivedOn: string;
    invoiceId?: string;
  }) => ApiResponse<PaymentView>;
  refund: (
    paymentId: string,
    input: { amount: string; reason: string },
  ) => ApiResponse<PaymentView>;
  statements: (config?: RequestConfig) => ApiResponse<FamilyStatement[]>;

  families: (config?: RequestConfig) => ApiResponse<FamilyAccount[]>;
  outstanding: (
    gradeLevelId?: string,
    config?: RequestConfig,
  ) => ApiResponse<OutstandingReport>;
  outstandingCsv: (gradeLevelId?: string) => ApiResponse<Blob>;
  collections: (
    range: { from: string; to: string },
    config?: RequestConfig,
  ) => ApiResponse<
    { month: string; received: string; refunded: string; net: string }[]
  >;
}
