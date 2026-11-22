"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentSchool } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { getPaymentsQueryOptions } from "@/common/integrations/tanstack-query/query-options/billing";
import { todayIn } from "@/common/lib/calendar-date";
import { formatCalendarDate } from "@/common/lib/format";
import { parseMoneyInput } from "@/common/lib/money-input";
import { api } from "@/common/service/api";
import type { PaymentView } from "@/common/types/billing";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Choice } from "../_shared/choice";
import { FamilySelect } from "../_shared/family-select";
import { PageHeader } from "../_shared/page-header";
import { openFile } from "../_shared/save-file";
import { useMoney } from "../_shared/use-money";

type OfflineMethod = "cash" | "transfer" | "cheque";

/** Record cash, transfer and cheque payments, and refund any payment (FEE-11, FEE-16). */
export function Payments() {
  const t = useTranslations("billing.payments");
  const errorMessage = useApiErrorMessage();
  const payments = useQuery(getPaymentsQueryOptions());

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />
      <RecordPayment />
      <section
        aria-labelledby="payments-list-title"
        className="flex flex-col gap-3"
      >
        <h2
          id="payments-list-title"
          className="text-lg font-semibold tracking-tight"
        >
          {t("recent")}
        </h2>
        <FormAlert
          message={payments.error ? errorMessage(payments.error) : null}
        />
        {payments.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : payments.data?.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("none")}</p>
        ) : (
          <ul className="bg-card divide-y rounded-lg border">
            {payments.data?.map((payment) => (
              <PaymentRow key={payment.id} payment={payment} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RecordPayment() {
  const t = useTranslations("billing.payments");
  const tBilling = useTranslations("billing");
  const school = useCurrentSchool();
  const money = useMoney();
  const queryClient = useQueryClient();
  const errorMessage = useApiErrorMessage();
  const [familyId, setFamilyId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<OfflineMethod>("transfer");
  const [reference, setReference] = useState("");
  const [receivedOn, setReceivedOn] = useState(() => todayIn(school.timeZone));
  const [invalid, setInvalid] = useState(false);

  const record = useMutation({
    mutationFn: async () => {
      const minor = parseMoneyInput(amount, school.currency);
      if (!familyId || !minor || minor === "0" || !receivedOn) {
        setInvalid(true);
        return null;
      }
      setInvalid(false);
      return api.billing.recordPayment({
        familyId,
        amount: minor,
        method,
        reference: reference.trim() || null,
        receivedOn,
      });
    },
    onSuccess: async (response) => {
      if (!response) return;
      toast.success(t("recorded", { receipt: response.data.receipt }));
      if (response.data.credit !== "0")
        toast.info(t("keptAsCredit", { amount: money(response.data.credit) }));
      setAmount("");
      setReference("");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.billing.all(),
      });
    },
  });

  return (
    <form
      className="bg-card flex flex-col gap-4 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        record.mutate();
      }}
    >
      <h2 className="font-medium">{t("record")}</h2>
      <p className="text-muted-foreground max-w-prose text-sm">
        {t("recordDescription")}
      </p>
      <FormAlert
        message={
          invalid
            ? t("invalid")
            : record.error
              ? errorMessage(record.error)
              : null
        }
      />
      <div className="flex flex-wrap items-end gap-4">
        <FamilySelect
          id="payment-family"
          value={familyId}
          onChange={setFamilyId}
        />
        <div className="flex w-36 flex-col gap-1.5">
          <Label htmlFor="payment-amount">
            {t("amount", { currency: school.currency })}
          </Label>
          <Input
            id="payment-amount"
            inputMode="decimal"
            className="tabular-nums"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
        <Choice
          id="payment-method"
          label={t("method")}
          className="sm:w-40"
          value={method}
          onChange={setMethod}
          items={(["transfer", "cash", "cheque"] as const).map((value) => ({
            value,
            label: tBilling(`methods.${value}`),
          }))}
        />
        <div className="flex w-full flex-col gap-1.5 sm:w-48">
          <Label htmlFor="payment-reference">{t("reference")}</Label>
          <Input
            id="payment-reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="payment-date">{t("receivedOn")}</Label>
          <Input
            id="payment-date"
            type="date"
            className="w-44"
            value={receivedOn}
            onChange={(event) => setReceivedOn(event.target.value)}
          />
        </div>
      </div>
      <Button type="submit" className="self-start" disabled={record.isPending}>
        {t("save")}
      </Button>
    </form>
  );
}

function PaymentRow({ payment }: Readonly<{ payment: PaymentView }>) {
  const t = useTranslations("billing.payments");
  const tBilling = useTranslations("billing");
  const locale = useLocale();
  const money = useMoney();
  const queryClient = useQueryClient();
  const errorMessage = useApiErrorMessage();
  const [refunding, setRefunding] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [invalid, setInvalid] = useState(false);
  const refundable = BigInt(payment.amount) - BigInt(payment.refunded);

  const receipt = useMutation({
    mutationFn: () => api.billing.pdf("receipt", payment.id, locale),
    onSuccess: (response) => openFile(response.data),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const refund = useMutation({
    mutationFn: async () => {
      const minor = parseMoneyInput(amount, payment.currency);
      if (
        !minor ||
        minor === "0" ||
        BigInt(minor) > refundable ||
        !reason.trim()
      ) {
        setInvalid(true);
        return null;
      }
      setInvalid(false);
      return api.billing.refund(payment.id, {
        amount: minor,
        reason: reason.trim(),
      });
    },
    onSuccess: async (response) => {
      if (!response) return;
      toast.success(t("refunded"));
      setRefunding(false);
      setAmount("");
      setReason("");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.billing.all(),
      });
    },
  });

  return (
    <li className="flex flex-col gap-3 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">{payment.familyName}</span>
          <span className="text-muted-foreground text-xs">
            <code>{payment.receipt}</code> ·{" "}
            {formatCalendarDate(payment.receivedOn, locale)} ·{" "}
            {tBilling(`methods.${payment.method}`)}
            {payment.reference ? ` · ${payment.reference}` : ""}
          </span>
          {payment.allocations.length > 0 && (
            <span className="text-muted-foreground text-xs">
              {t("appliedTo", {
                invoices: payment.allocations
                  .map((entry) => entry.invoiceNumber)
                  .join(", "),
              })}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end">
          <span className="tabular-nums">
            {money(payment.amount, payment.currency)}
          </span>
          {payment.refunded !== "0" && (
            <span className="text-destructive text-xs tabular-nums">
              {t("refundedAmount", {
                amount: money(payment.refunded, payment.currency),
              })}
            </span>
          )}
          {payment.credit !== "0" && (
            <span className="text-success text-xs tabular-nums">
              {t("credit", { amount: money(payment.credit, payment.currency) })}
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => receipt.mutate()}>
          {t("receipt")}
          <span className="sr-only"> {payment.receipt}</span>
        </Button>
        {refundable > BigInt(0) && (
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={refunding}
            onClick={() => setRefunding((open) => !open)}
          >
            {t("refund")}
            <span className="sr-only"> {payment.receipt}</span>
          </Button>
        )}
      </div>
      {refunding && (
        <form
          className="bg-muted/40 flex flex-wrap items-end gap-3 rounded-md p-3"
          onSubmit={(event) => {
            event.preventDefault();
            refund.mutate();
          }}
        >
          <div className="basis-full empty:hidden">
            <FormAlert
              message={
                invalid
                  ? t("refundInvalid", {
                      max: money(refundable, payment.currency),
                    })
                  : refund.error
                    ? errorMessage(refund.error)
                    : null
              }
            />
          </div>
          <div className="flex w-36 flex-col gap-1.5">
            <Label htmlFor={`refund-${payment.id}-amount`}>
              {t("amount", { currency: payment.currency })}
            </Label>
            <Input
              id={`refund-${payment.id}-amount`}
              inputMode="decimal"
              className="tabular-nums"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <Label htmlFor={`refund-${payment.id}-reason`}>{t("reason")}</Label>
            <Input
              id={`refund-${payment.id}-reason`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <Button
            type="submit"
            variant="destructive"
            disabled={refund.isPending}
          >
            {t("confirmRefund")}
          </Button>
        </form>
      )}
    </li>
  );
}
