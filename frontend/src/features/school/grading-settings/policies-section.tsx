"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { AGGREGATION_METHODS, type AggregationMethod, type GradingPolicy } from "@/common/types/assessment";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GradingSettings } from "./use-grading-settings";

const DEFAULT = "";
const NO_SCALE = "";

function PolicyEditor({
  policy,
  subjectId,
  settings,
}: Readonly<{ policy: GradingPolicy | undefined; subjectId: string | null; settings: GradingSettings }>) {
  const t = useTranslations("gradingSettings.policies");
  const tMethods = useTranslations("gradingSettings.methods");
  const errorMessage = useApiErrorMessage();
  const [method, setMethod] = useState<AggregationMethod>(policy?.method ?? "weighted_average");
  const [reportingScaleId, setReportingScaleId] = useState(policy?.reportingScaleId ?? NO_SCALE);
  const [categories, setCategories] = useState(
    (policy?.categories ?? []).map((category) => ({ name: category.name, weight: String(category.weight) })),
  );
  const [error, setError] = useState<string | null>(null);
  const idPrefix = `policy-${subjectId ?? "default"}`;
  const methodItems = AGGREGATION_METHODS.map((value) => ({ value, label: tMethods(value) }));
  const scaleItems = [
    { value: NO_SCALE, label: t("noReportingScale") },
    ...(settings.scales.data ?? []).map((scale) => ({ value: scale.id, label: scale.name })),
  ];

  const save = () => {
    setError(null);
    settings.savePolicy.mutate(
      {
        subjectId,
        reportingScaleId: reportingScaleId || null,
        method,
        categories: categories
          .filter((category) => category.name.trim())
          .map((category) => ({ name: category.name.trim(), weight: Number(category.weight) || 0 })),
      },
      { onSuccess: () => toast.success(t("saved")), onError: (saveError) => setError(errorMessage(saveError)) },
    );
  };

  return (
    <div className="bg-card flex flex-col gap-4 rounded-lg border p-4">
      <FormAlert message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-method`}>{t("method")}</Label>
          <Select items={methodItems} value={method} onValueChange={(value) => value && setMethod(value as AggregationMethod)}>
            <SelectTrigger id={`${idPrefix}-method`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {methodItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-scale`}>{t("reportingScale")}</Label>
          <Select items={scaleItems} value={reportingScaleId} onValueChange={(value) => setReportingScaleId(value ?? NO_SCALE)}>
            <SelectTrigger id={`${idPrefix}-scale`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scaleItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t("categories")}</legend>
        {categories.length === 0 && <p className="text-muted-foreground text-sm">{t("noCategories")}</p>}
        {categories.map((category, index) => (
          <div key={index} className="grid grid-cols-[1fr_6rem_2rem] items-center gap-2">
            <Input
              aria-label={`${t("categoryName")} ${index + 1}`}
              value={category.name}
              onChange={(event) =>
                setCategories((current) => current.map((entry, position) => (position === index ? { ...entry, name: event.target.value } : entry)))
              }
            />
            <Input
              aria-label={`${t("weight")} ${index + 1}`}
              inputMode="numeric"
              className="tabular-nums"
              value={category.weight}
              onChange={(event) =>
                setCategories((current) => current.map((entry, position) => (position === index ? { ...entry, weight: event.target.value } : entry)))
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("removeCategory", { name: category.name || String(index + 1) })}
              onClick={() => setCategories((current) => current.filter((_, position) => position !== index))}
            >
              <Trash2Icon aria-hidden />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setCategories((current) => [...current, { name: "", weight: "1" }])}
        >
          <PlusIcon aria-hidden />
          {t("addCategory")}
        </Button>
      </fieldset>
      <Button type="button" className="self-start" disabled={settings.savePolicy.isPending} onClick={save}>
        {t("save")}
      </Button>
    </div>
  );
}

export function PoliciesSection({ settings }: Readonly<{ settings: GradingSettings }>) {
  const t = useTranslations("gradingSettings.policies");
  const [subjectId, setSubjectId] = useState(DEFAULT);
  const subjectItems = [
    { value: DEFAULT, label: t("default") },
    ...(settings.subjects.data ?? []).map((subject) => ({ value: subject.id, label: subject.name })),
  ];
  const policy = settings.policies.data?.find((candidate) => (candidate.subjectId ?? DEFAULT) === subjectId);

  return (
    <section aria-labelledby="policies-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="policies-title" className="text-lg font-semibold tracking-tight">
          {t("title")}
        </h2>
        <p className="text-muted-foreground max-w-prose text-sm">{t("description")}</p>
      </div>
      <div className="flex w-full flex-col gap-1.5 sm:w-72">
        <Label htmlFor="policy-subject">{t("subject")}</Label>
        <Select items={subjectItems} value={subjectId} onValueChange={(value) => setSubjectId(value ?? DEFAULT)}>
          <SelectTrigger id="policy-subject" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {subjectItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {settings.policies.isSuccess && (
        <PolicyEditor key={`${subjectId}-${policy?.id ?? "new"}`} policy={policy} subjectId={subjectId || null} settings={settings} />
      )}
    </section>
  );
}
