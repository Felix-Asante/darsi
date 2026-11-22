"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { getStatementsQueryOptions } from "@/common/integrations/tanstack-query/query-options/billing";
import { formatCalendarDate } from "@/common/lib/format";
import { api } from "@/common/service/api";
import type { FamilyStatement } from "@/common/types/billing";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoiceStateBadge } from "../_shared/invoice-state-badge";
import { PageHeader } from "../_shared/page-header";
import { openFile } from "../_shared/save-file";
import { useMoney } from "../_shared/use-money";

/** A guardian's invoices, balance, payments and receipts, with card payment (FEE-10, FEE-12). */
export function FamilyBilling() {
  const t = useTranslations("billing.familyAccount");
  const errorMessage = useApiErrorMessage();
  const statements = useQuery(getStatementsQueryOptions());
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("paid") === "1") toast.success(t("paymentSent"));
  }, [searchParams, t]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />
      <FormAlert
        message={statements.error ? errorMessage(statements.error) : null}
      />
      {statements.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : statements.data?.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("none")}</p>
      ) : (
        statements.data?.map((statement) => (
          <Statement key={statement.familyId} statement={statement} />
        ))
      )}
    </div>
  );
}

function Statement({ statement }: Readonly<{ statement: FamilyStatement }>) {
  const t = useTranslations("billing.familyAccount");
  const tBilling = useTranslations("billing");
  const locale = useLocale();
  const money = useMoney();
  const errorMessage = useApiErrorMessage();
  // One key per invoice while the page is open, so repeated clicks reuse the same checkout.
  const keys = useRef(new Map<string, string>());
  const pay = useMutation({
    mutationFn: (invoiceId: string) => {
      const key = keys.current.get(invoiceId) ?? crypto.randomUUID();
      keys.current.set(invoiceId, key);
      return api.billing.checkout(invoiceId, key, locale);
    },
    onSuccess: (response) => window.location.assign(response.data.url),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const download = useMutation({
    mutationFn: ({ kind, id }: { kind: "invoice" | "receipt"; id: string }) =>
      api.billing.pdf(kind, id, locale),
    onSuccess: (response) => openFile(response.data),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const headingId = `family-${statement.familyId}`;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="bg-card flex flex-wrap items-center gap-x-8 gap-y-2 rounded-lg border p-4">
        <h2
          id={headingId}
          className="flex-1 text-lg font-semibold tracking-tight"
        >
          {statement.familyName}
        </h2>
        <dl className="flex gap-8">
          <div>
            <dt className="text-muted-foreground text-xs">{t("balance")}</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {money(statement.balance)}
            </dd>
          </div>
          {statement.credit !== "0" && (
            <div>
              <dt className="text-muted-foreground text-xs">{t("credit")}</dt>
              <dd className="text-success text-lg font-semibold tabular-nums">
                {money(statement.credit)}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <h3 className="font-medium">{t("invoices")}</h3>
      {statement.invoices.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noInvoices")}</p>
      ) : (
        <ul className="bg-card divide-y rounded-lg border">
          {statement.invoices.map((invoice) => (
            <li
              key={invoice.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <code className="text-sm">{invoice.number}</code>
                <span className="text-muted-foreground text-xs">
                  {invoice.reference ? `${invoice.reference} · ` : ""}
                  {invoice.dueDate &&
                    tBilling("dueOn", {
                      date: formatCalendarDate(invoice.dueDate, locale),
                    })}
                </span>
              </div>
              <span className="tabular-nums">
                {money(invoice.balance, invoice.currency)}
              </span>
              <InvoiceStateBadge state={invoice.state} />
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  download.mutate({ kind: "invoice", id: invoice.id })
                }
              >
                {tBilling("pdf")}
                <span className="sr-only"> {invoice.number}</span>
              </Button>
              {invoice.balance !== "0" && (
                <Button
                  size="sm"
                  disabled={pay.isPending}
                  onClick={() => pay.mutate(invoice.id)}
                >
                  {t("pay")}
                  <span className="sr-only"> {invoice.number}</span>
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <h3 className="font-medium">{t("payments")}</h3>
      {statement.payments.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noPayments")}</p>
      ) : (
        <ul className="bg-card divide-y rounded-lg border">
          {statement.payments.map((payment) => (
            <li
              key={payment.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <code className="text-sm">{payment.receipt}</code>
                <span className="text-muted-foreground text-xs">
                  {formatCalendarDate(payment.receivedOn, locale)} ·{" "}
                  {tBilling(`methods.${payment.method}`)}
                </span>
              </div>
              <span className="tabular-nums">
                {money(payment.amount, payment.currency)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  download.mutate({ kind: "receipt", id: payment.id })
                }
              >
                {t("receipt")}
                <span className="sr-only"> {payment.receipt}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
