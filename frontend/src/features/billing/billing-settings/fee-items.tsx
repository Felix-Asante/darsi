"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentSchool } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { getFeeItemsQueryOptions } from "@/common/integrations/tanstack-query/query-options/billing";
import { formatNumber } from "@/common/lib/format";
import { parseMoneyInput, parsePercentInput } from "@/common/lib/money-input";
import { api } from "@/common/service/api";
import type { FeeItem, FeeKind } from "@/common/types/billing";
import { FormAlert } from "@/components/form/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Choice } from "../_shared/choice";
import { useMoney } from "../_shared/use-money";
import { Section } from "./section";

const KINDS: FeeKind[] = [
  "tuition",
  "registration",
  "application",
  "deposit",
  "uniform",
  "trip",
  "other",
];

/** What the school charges for (FEE-2). */
export function FeeItems() {
  const t = useTranslations("billing.feeItems");
  const tBilling = useTranslations("billing");
  const locale = useLocale();
  const school = useCurrentSchool();
  const money = useMoney();
  const queryClient = useQueryClient();
  const errorMessage = useApiErrorMessage();
  const items = useQuery(getFeeItemsQueryOptions());
  const [name, setName] = useState("");
  const [kind, setKind] = useState<FeeKind>("tuition");
  const [amount, setAmount] = useState("");
  const [tax, setTax] = useState("0");
  const [code, setCode] = useState("");
  const [invalid, setInvalid] = useState(false);
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.billing.all() });

  const create = useMutation({
    mutationFn: async () => {
      const minor = parseMoneyInput(amount, school.currency);
      const taxRateBp = parsePercentInput(tax);
      if (!name.trim() || minor === null || taxRateBp === null) {
        setInvalid(true);
        return null;
      }
      setInvalid(false);
      return api.billing.saveFeeItem({
        name: name.trim(),
        kind,
        amount: minor,
        taxRateBp,
        accountingCode: code.trim() || null,
        active: true,
      });
    },
    onSuccess: async (response) => {
      if (!response) return;
      setName("");
      setAmount("");
      setCode("");
      await refresh();
    },
  });
  const toggle = useMutation({
    mutationFn: (item: FeeItem) =>
      api.billing.saveFeeItem(
        {
          name: item.name,
          kind: item.kind,
          amount: item.amount,
          taxRateBp: item.taxRateBp,
          accountingCode: item.accountingCode,
          active: !item.active,
        },
        item.id,
      ),
    onSuccess: refresh,
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Section id="fee-items" title={t("title")} description={t("description")}>
      {(items.data ?? []).length > 0 && (
        <ul className="bg-card divide-y rounded-lg border">
          {items.data?.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5"
            >
              <span className="min-w-0 flex-1 font-medium">{item.name}</span>
              <Badge variant="outline">{tBilling(`kinds.${item.kind}`)}</Badge>
              {item.accountingCode && (
                <code className="text-muted-foreground text-xs">
                  {item.accountingCode}
                </code>
              )}
              <span className="text-muted-foreground text-sm tabular-nums">
                {t("tax", {
                  rate: formatNumber(item.taxRateBp / 10_000, locale, {
                    style: "percent",
                    maximumFractionDigits: 2,
                  }),
                })}
              </span>
              <span className="tabular-nums">
                {money(item.amount, item.currency)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggle.mutate(item)}
              >
                {item.active ? t("deactivate") : t("activate")}
                <span className="sr-only"> {item.name}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="bg-card flex flex-col gap-4 rounded-lg border p-4"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <FormAlert
          message={
            invalid
              ? t("invalid")
              : create.error
                ? errorMessage(create.error)
                : null
          }
        />
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex w-full flex-col gap-1.5 sm:w-56">
            <Label htmlFor="fee-name">{t("name")}</Label>
            <Input
              id="fee-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <Choice
            id="fee-kind"
            label={t("kind")}
            className="sm:w-44"
            value={kind}
            onChange={setKind}
            items={KINDS.map((value) => ({
              value,
              label: tBilling(`kinds.${value}`),
            }))}
          />
          <div className="flex w-36 flex-col gap-1.5">
            <Label htmlFor="fee-amount">
              {t("amount", { currency: school.currency })}
            </Label>
            <Input
              id="fee-amount"
              inputMode="decimal"
              className="tabular-nums"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="flex w-24 flex-col gap-1.5">
            <Label htmlFor="fee-tax">{t("taxRate")}</Label>
            <Input
              id="fee-tax"
              inputMode="decimal"
              className="tabular-nums"
              value={tax}
              onChange={(event) => setTax(event.target.value)}
            />
          </div>
          <div className="flex w-36 flex-col gap-1.5">
            <Label htmlFor="fee-code">{t("accountingCode")}</Label>
            <Input
              id="fee-code"
              className="font-mono"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>
        </div>
        <Button
          type="submit"
          className="self-start"
          disabled={create.isPending}
        >
          {t("add")}
        </Button>
      </form>
    </Section>
  );
}
