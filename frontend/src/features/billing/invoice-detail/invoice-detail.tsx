"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentSchool } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { useRouter } from "@/common/i18n/navigation";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { getInvoiceQueryOptions } from "@/common/integrations/tanstack-query/query-options/billing";
import { formatCalendarDate, formatDate } from "@/common/lib/format";
import { parseMoneyInput } from "@/common/lib/money-input";
import { api } from "@/common/service/api";
import type { InvoiceDetail as Detail } from "@/common/types/billing";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InvoiceStateBadge } from "../_shared/invoice-state-badge";
import { openFile } from "../_shared/save-file";
import { useMoney } from "../_shared/use-money";

/** One invoice: lines, totals, credit notes and payments; drafts are issued here (FEE-6, FEE-8). */
export function InvoiceDetail({ invoiceId }: Readonly<{ invoiceId: string }>) {
  const t = useTranslations("billing.invoice");
  const tBilling = useTranslations("billing");
  const locale = useLocale();
  const money = useMoney();
  const school = useCurrentSchool();
  const router = useRouter();
  const queryClient = useQueryClient();
  const errorMessage = useApiErrorMessage();
  const invoice = useQuery(getInvoiceQueryOptions(invoiceId));
  const [dueDate, setDueDate] = useState("");
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.billing.all() });

  const issue = useMutation({
    mutationFn: () => api.billing.issue(invoiceId, dueDate || undefined),
    onSuccess: async () => {
      toast.success(t("issued"));
      await refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: () => api.billing.deleteDraft(invoiceId),
    onSuccess: async () => {
      await refresh();
      router.push("/billing");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const pdf = useMutation({
    mutationFn: () => api.billing.pdf("invoice", invoiceId, locale),
    onSuccess: (response) => openFile(response.data),
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (invoice.error) return <FormAlert message={errorMessage(invoice.error)} />;
  if (!invoice.data) return <Skeleton className="h-96 w-full" />;
  const data = invoice.data;
  const draft = data.status === "draft";

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="flex flex-wrap items-center gap-3 text-xl font-semibold tracking-tight">
            {data.number ? <code>{data.number}</code> : t("draftTitle")}
            <InvoiceStateBadge state={data.state} />
          </h1>
          <p className="text-muted-foreground text-sm">
            {data.familyName}
            {data.reference ? ` · ${data.reference}` : ""}
          </p>
          {data.issueDate && data.dueDate && (
            <p className="text-muted-foreground text-sm tabular-nums">
              {t("dates", {
                issued: formatCalendarDate(data.issueDate, locale),
                due: formatCalendarDate(data.dueDate, locale),
              })}
            </p>
          )}
        </div>
        {!draft && (
          <Button
            variant="outline"
            disabled={pdf.isPending}
            onClick={() => pdf.mutate()}
          >
            {tBilling("pdf")}
          </Button>
        )}
      </div>

      <div className="bg-card rounded-lg border">
        <Table label={t("title")}>
          <TableHeader>
            <TableRow>
              <TableHead>{t("line")}</TableHead>
              <TableHead className="text-end">{t("quantity")}</TableHead>
              <TableHead className="text-end">{t("unit")}</TableHead>
              <TableHead className="text-end">{t("discount")}</TableHead>
              <TableHead className="text-end">{t("tax")}</TableHead>
              <TableHead className="text-end">{t("amount")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span>{line.description}</span>
                    {line.student && (
                      <span className="text-muted-foreground text-xs">
                        {line.student.name}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  {line.quantity}
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  {money(line.unitAmount, data.currency)}
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  {line.discount === "0"
                    ? "—"
                    : `−${money(line.discount, data.currency)}`}
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  {money(line.tax, data.currency)}
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  {money(line.total, data.currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <Total
              label={t("subtotal")}
              value={money(data.subtotal, data.currency)}
            />
            {data.discountTotal !== "0" && (
              <Total
                label={t("discounts")}
                value={`−${money(data.discountTotal, data.currency)}`}
              />
            )}
            <Total
              label={t("taxTotal")}
              value={money(data.taxTotal, data.currency)}
            />
            <Total
              label={t("total")}
              value={money(data.total, data.currency)}
              strong
            />
            {!draft && (
              <>
                {data.credited !== "0" && (
                  <Total
                    label={t("credited")}
                    value={`−${money(data.credited, data.currency)}`}
                  />
                )}
                {data.paid !== "0" && (
                  <Total
                    label={t("paid")}
                    value={`−${money(data.paid, data.currency)}`}
                  />
                )}
                <Total
                  label={t("balance")}
                  value={money(data.balance, data.currency)}
                  strong
                />
              </>
            )}
          </TableFooter>
        </Table>
      </div>

      {data.notes && (
        <p className="text-muted-foreground max-w-prose text-sm whitespace-pre-line">
          {data.notes}
        </p>
      )}

      {draft ? (
        <section
          aria-labelledby="issue-title"
          className="bg-card flex flex-col gap-4 rounded-lg border p-4"
        >
          <h2 id="issue-title" className="font-medium">
            {t("issueTitle")}
          </h2>
          <p className="text-muted-foreground max-w-prose text-sm">
            {t("issueDescription")}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="issue-due">{t("dueDate")}</Label>
              <Input
                id="issue-due"
                type="date"
                className="w-44"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
            <Button disabled={issue.isPending} onClick={() => issue.mutate()}>
              {t("issue")}
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              {t("deleteDraft")}
            </Button>
          </div>
        </section>
      ) : (
        <>
          <CreditNotes invoice={data} onChange={refresh} />
          {data.allocations.length > 0 && (
            <section
              aria-labelledby="payments-title"
              className="flex flex-col gap-3"
            >
              <h2 id="payments-title" className="font-medium">
                {t("payments")}
              </h2>
              <ul className="bg-card divide-y rounded-lg border">
                {data.allocations.map((allocation, index) => (
                  <li
                    key={`${allocation.paymentId}-${index}`}
                    className="flex justify-between gap-4 px-4 py-2.5 text-sm"
                  >
                    <span className="tabular-nums">
                      {formatDate(
                        allocation.createdAt,
                        locale,
                        school.timeZone,
                      )}
                    </span>
                    <span className="tabular-nums">
                      {money(allocation.amount, data.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Total({
  label,
  value,
  strong,
}: Readonly<{ label: string; value: string; strong?: boolean }>) {
  return (
    <TableRow>
      <TableCell colSpan={5} className="text-end">
        {label}
      </TableCell>
      <TableCell
        className={`text-end tabular-nums ${strong ? "font-semibold" : ""}`}
      >
        {value}
      </TableCell>
    </TableRow>
  );
}

function CreditNotes({
  invoice,
  onChange,
}: Readonly<{ invoice: Detail; onChange: () => Promise<unknown> }>) {
  const t = useTranslations("billing.invoice");
  const school = useCurrentSchool();
  const money = useMoney();
  const errorMessage = useApiErrorMessage();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [invalid, setInvalid] = useState(false);
  const credit = useMutation({
    mutationFn: async () => {
      const minor = parseMoneyInput(amount, school.currency);
      if (!minor || minor === "0" || !reason.trim()) {
        setInvalid(true);
        return null;
      }
      setInvalid(false);
      return api.billing.creditNote(invoice.id, {
        amount: minor,
        reason: reason.trim(),
      });
    },
    onSuccess: async (response) => {
      if (!response) return;
      setAmount("");
      setReason("");
      toast.success(t("creditIssued"));
      await onChange();
    },
  });

  return (
    <section aria-labelledby="credit-title" className="flex flex-col gap-3">
      <h2 id="credit-title" className="font-medium">
        {t("creditNotes")}
      </h2>
      <p className="text-muted-foreground max-w-prose text-sm">
        {t("creditDescription")}
      </p>
      {invoice.creditNotes.length > 0 && (
        <ul className="bg-card divide-y rounded-lg border">
          {invoice.creditNotes.map((note) => (
            <li
              key={note.id}
              className="flex flex-wrap justify-between gap-4 px-4 py-2.5 text-sm"
            >
              <code>{note.number}</code>
              <span className="text-muted-foreground min-w-0 flex-1">
                {note.reason}
              </span>
              <span className="tabular-nums">
                −{money(note.amount, invoice.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {invoice.balance !== "0" && (
        <form
          className="bg-card flex flex-wrap items-end gap-3 rounded-lg border p-4"
          onSubmit={(event) => {
            event.preventDefault();
            credit.mutate();
          }}
        >
          <div className="basis-full empty:hidden">
            <FormAlert
              message={
                invalid
                  ? t("creditInvalid")
                  : credit.error
                    ? errorMessage(credit.error)
                    : null
              }
            />
          </div>
          <div className="flex w-36 flex-col gap-1.5">
            <Label htmlFor="credit-amount">
              {t("creditAmount", { currency: invoice.currency })}
            </Label>
            <Input
              id="credit-amount"
              inputMode="decimal"
              className="tabular-nums"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <Label htmlFor="credit-reason">{t("creditReason")}</Label>
            <Input
              id="credit-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" disabled={credit.isPending}>
            {t("credit")}
          </Button>
        </form>
      )}
    </section>
  );
}
