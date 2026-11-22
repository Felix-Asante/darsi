import { apiEndpoints } from "../api/end-points";
import type { HttpClient } from "../http.service";
import type { IBillingService } from "./interface";

export function createBillingService(http: HttpClient): IBillingService {
  const { billing } = apiEndpoints;
  return {
    settings: (config) => http.get(billing.settings(), undefined, config),
    saveSettings: (input) => http.put(billing.settings(), input),
    connectStripe: (locale) => http.post(billing.connectStripe(locale)),
    feeItems: (config) => http.get(billing.feeItems(), undefined, config),
    saveFeeItem: (input, id) =>
      id
        ? http.put(billing.feeItem(id), input)
        : http.post(billing.feeItems(), input),
    structures: (academicYearId, config) =>
      http.get(billing.structures(academicYearId), undefined, config),
    saveStructure: (input) => http.put(billing.structures(), input),
    discounts: (config) => http.get(billing.discounts(), undefined, config),
    saveDiscount: (input, id) =>
      id
        ? http.put(billing.discount(id), input)
        : http.post(billing.discounts(), input),
    setStudentDiscounts: (studentId, discountIds) =>
      http.put(billing.studentDiscounts(studentId), { discountIds }),

    invoices: (query, config) =>
      http.get(billing.invoices(query), undefined, config),
    invoice: (id, config) => http.get(billing.invoice(id), undefined, config),
    createDraft: (input) => http.post(billing.invoices(), input),
    issue: (id, dueDate) =>
      http.post(billing.issue(id), dueDate ? { dueDate } : {}),
    deleteDraft: (id) => http.delete(billing.invoice(id)),
    creditNote: (id, input) => http.post(billing.creditNotes(id), input),
    checkout: (id, idempotencyKey, locale) =>
      http.post(billing.checkout(id, locale), undefined, {
        headers: { "Idempotency-Key": idempotencyKey },
        isRetryable: true,
      }),
    pdf: (path, id, locale) =>
      http.get(billing.pdf(path, id, locale), undefined, {
        responseType: "blob",
      }),
    previewRun: (period) =>
      http.post(billing.previewRun(), period, { isRetryable: true }),
    run: (period) => http.post(billing.runs(), period),

    payments: (familyId, config) =>
      http.get(billing.payments(familyId), undefined, config),
    recordPayment: (input) => http.post(billing.payments(), input),
    refund: (paymentId, input) => http.post(billing.refunds(paymentId), input),
    statements: (config) => http.get(billing.statements(), undefined, config),

    families: (config) => http.get(billing.families(), undefined, config),
    outstanding: (gradeLevelId, config) =>
      http.get(billing.outstanding(gradeLevelId), undefined, config),
    outstandingCsv: (gradeLevelId) =>
      http.get(billing.outstandingCsv(gradeLevelId), undefined, {
        responseType: "blob",
      }),
    collections: (range, config) =>
      http.get(billing.collections(range), undefined, config),
  };
}
