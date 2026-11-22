"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useCurrentSchool } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import {
  getDiscountsQueryOptions,
  getFeeItemsQueryOptions,
} from "@/common/integrations/tanstack-query/query-options/billing";
import { formatNumber } from "@/common/lib/format";
import { parseMoneyInput, parsePercentInput } from "@/common/lib/money-input";
import { api } from "@/common/service/api";
import type { Discount } from "@/common/types/billing";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Choice } from "../_shared/choice";
import { useMoney } from "../_shared/use-money";
import { Section } from "./section";

/** Sibling discounts, scholarships and other reductions (FEE-4). */
export function Discounts() {
  const t = useTranslations("billing.discounts");
  const locale = useLocale();
  const school = useCurrentSchool();
  const money = useMoney();
  const queryClient = useQueryClient();
  const errorMessage = useApiErrorMessage();
  const discounts = useQuery(getDiscountsQueryOptions());
  const items = useQuery(getFeeItemsQueryOptions());
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Discount["kind"]>("percent");
  const [value, setValue] = useState("");
  const [feeItemIds, setFeeItemIds] = useState<string[]>([]);
  const [invalid, setInvalid] = useState(false);

  const describe = (discount: Discount) =>
    discount.kind === "percent"
      ? formatNumber(Number(discount.value) / 10_000, locale, {
          style: "percent",
          maximumFractionDigits: 2,
        })
      : money(discount.value);

  const create = useMutation({
    mutationFn: async () => {
      const parsed =
        kind === "percent"
          ? parsePercentInput(value)?.toString()
          : parseMoneyInput(value, school.currency);
      if (!name.trim() || !parsed || parsed === "0") {
        setInvalid(true);
        return null;
      }
      setInvalid(false);
      return api.billing.saveDiscount({
        name: name.trim(),
        kind,
        value: parsed,
        feeItemIds,
      });
    },
    onSuccess: async (response) => {
      if (!response) return;
      setName("");
      setValue("");
      setFeeItemIds([]);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.billing.all(),
      });
    },
  });

  return (
    <Section id="discounts" title={t("title")} description={t("description")}>
      {(discounts.data ?? []).length > 0 && (
        <ul className="bg-card divide-y rounded-lg border">
          {discounts.data?.map((discount) => (
            <li
              key={discount.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5"
            >
              <span className="min-w-0 flex-1 font-medium">
                {discount.name}
              </span>
              <span className="text-muted-foreground text-sm">
                {discount.feeItemIds.length
                  ? discount.feeItemIds
                      .map(
                        (id) =>
                          items.data?.find((item) => item.id === id)?.name,
                      )
                      .join(", ")
                  : t("allFees")}
              </span>
              <span className="text-muted-foreground text-sm tabular-nums">
                {t("students", { count: discount.studentIds.length })}
              </span>
              <span className="tabular-nums">{describe(discount)}</span>
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
            <Label htmlFor="discount-name">{t("name")}</Label>
            <Input
              id="discount-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <Choice
            id="discount-kind"
            label={t("kind")}
            className="sm:w-44"
            value={kind}
            onChange={setKind}
            items={(["percent", "fixed"] as const).map((entry) => ({
              value: entry,
              label: t(`kinds.${entry}`),
            }))}
          />
          <div className="flex w-36 flex-col gap-1.5">
            <Label htmlFor="discount-value">
              {kind === "percent"
                ? t("percent")
                : t("amount", { currency: school.currency })}
            </Label>
            <Input
              id="discount-value"
              inputMode="decimal"
              className="tabular-nums"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
        </div>
        {(items.data ?? []).length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">
              {t("appliesTo")}
            </legend>
            <p className="text-muted-foreground text-xs">
              {t("appliesToHint")}
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {items.data?.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`discount-item-${item.id}`}
                    checked={feeItemIds.includes(item.id)}
                    onCheckedChange={(checked) =>
                      setFeeItemIds((current) =>
                        checked === true
                          ? [...current, item.id]
                          : current.filter((id) => id !== item.id),
                      )
                    }
                  />
                  <Label
                    htmlFor={`discount-item-${item.id}`}
                    className="font-normal"
                  >
                    {item.name}
                  </Label>
                </div>
              ))}
            </div>
          </fieldset>
        )}
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
