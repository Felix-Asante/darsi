"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { getBillingSettingsQueryOptions } from "@/common/integrations/tanstack-query/query-options/billing";
import { api } from "@/common/service/api";
import type { BillingSettings as Settings } from "@/common/types/billing";
import { FormAlert } from "@/components/form/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Choice } from "../_shared/choice";
import { PageHeader } from "../_shared/page-header";
import { Discounts } from "./discounts";
import { FeeItems } from "./fee-items";
import { FeeStructures } from "./fee-structures";
import { Section } from "./section";
import { StudentDiscounts } from "./student-discounts";

/** How the school bills: numbering, terms, reminders, card payments, fees and discounts (FEE-1–4, FEE-15). */
export function BillingSettings() {
  const t = useTranslations("billing.settings");
  const settings = useQuery(getBillingSettingsQueryOptions());
  return (
    <div className="flex flex-col gap-10">
      <PageHeader title={t("title")} description={t("description")} />
      <Section
        id="billing-general"
        title={t("generalTitle")}
        description={t("generalDescription")}
      >
        {settings.data ? (
          <SettingsForm initial={settings.data} />
        ) : (
          <Skeleton className="h-40 w-full" />
        )}
      </Section>
      <Section
        id="billing-stripe"
        title={t("stripeTitle")}
        description={t("stripeDescription")}
      >
        {settings.data && (
          <StripeConnect connected={settings.data.stripeConnected} />
        )}
      </Section>
      <FeeItems />
      <FeeStructures />
      <Discounts />
      <StudentDiscounts />
    </div>
  );
}

const toDays = (text: string) =>
  text
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map((value) => Number.parseInt(value, 10));

function SettingsForm({ initial }: Readonly<{ initial: Settings }>) {
  const t = useTranslations("billing.settings");
  const queryClient = useQueryClient();
  const errorMessage = useApiErrorMessage();
  const [rounding, setRounding] = useState(initial.rounding);
  const [prefix, setPrefix] = useState(initial.invoicePrefix);
  const [terms, setTerms] = useState(String(initial.paymentTermsDays));
  const [before, setBefore] = useState(initial.reminderDaysBefore.join(", "));
  const [after, setAfter] = useState(initial.reminderDaysAfter.join(", "));
  const save = useMutation({
    mutationFn: () =>
      api.billing.saveSettings({
        rounding,
        invoicePrefix: prefix.trim().toUpperCase(),
        paymentTermsDays: Number.parseInt(terms, 10) || 0,
        reminderDaysBefore: toDays(before),
        reminderDaysAfter: toDays(after),
      }),
    onSuccess: () => {
      toast.success(t("saved"));
      return queryClient.invalidateQueries({
        queryKey: queryKeys.billing.all(),
      });
    },
  });
  return (
    <form
      className="bg-card flex flex-col gap-4 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <FormAlert message={save.error ? errorMessage(save.error) : null} />
      <p className="text-sm">
        {t("currency")}: <code>{initial.currency}</code>
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="billing-prefix">{t("prefix")}</Label>
          <Input
            id="billing-prefix"
            className="w-28 font-mono uppercase"
            value={prefix}
            onChange={(event) => setPrefix(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="billing-terms">{t("paymentTerms")}</Label>
          <Input
            id="billing-terms"
            inputMode="numeric"
            className="w-28 tabular-nums"
            value={terms}
            onChange={(event) => setTerms(event.target.value)}
          />
        </div>
        <Choice
          id="billing-rounding"
          label={t("rounding")}
          value={rounding}
          onChange={setRounding}
          items={(["half_up", "half_even"] as const).map((value) => ({
            value,
            label: t(`roundings.${value}`),
          }))}
        />
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex w-full flex-col gap-1.5 sm:w-64">
          <Label htmlFor="billing-before">{t("remindBefore")}</Label>
          <Input
            id="billing-before"
            className="tabular-nums"
            value={before}
            onChange={(event) => setBefore(event.target.value)}
          />
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-64">
          <Label htmlFor="billing-after">{t("remindAfter")}</Label>
          <Input
            id="billing-after"
            className="tabular-nums"
            value={after}
            onChange={(event) => setAfter(event.target.value)}
          />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">{t("remindHint")}</p>
      <Button type="submit" className="self-start" disabled={save.isPending}>
        {t("save")}
      </Button>
    </form>
  );
}

function StripeConnect({ connected }: Readonly<{ connected: boolean }>) {
  const t = useTranslations("billing.settings");
  const locale = useLocale();
  const errorMessage = useApiErrorMessage();
  const connect = useMutation({
    mutationFn: () => api.billing.connectStripe(locale),
    onSuccess: (response) => window.location.assign(response.data.url),
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <div className="bg-card flex flex-wrap items-center gap-4 rounded-lg border p-4">
      <Badge variant={connected ? "success" : "outline"}>
        {connected ? t("stripeConnected") : t("stripeNotConnected")}
      </Badge>
      <Button
        variant="outline"
        disabled={connect.isPending}
        onClick={() => connect.mutate()}
      >
        {connected ? t("stripeManage") : t("stripeConnect")}
      </Button>
    </div>
  );
}
