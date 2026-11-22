"use client";

import { useMutation } from "@tanstack/react-query";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { fromMastery, isNumericScale, toMastery } from "@/common/lib/grading";
import { api } from "@/common/service/api";
import type { GradingScale } from "@/common/types/assessment";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GradingSettings } from "./use-grading-settings";

type Row = { source: string; target: string };

function ScaleSelect({
  id,
  label,
  scales,
  value,
  onChange,
}: Readonly<{ id: string; label: string; scales: GradingScale[]; value: string | null; onChange: (id: string) => void }>) {
  const items = scales.map((scale) => ({ value: scale.id, label: scale.name }));
  return (
    <div className="flex w-full flex-col gap-1.5 sm:w-60">
      <Label htmlFor={id}>{label}</Label>
      <Select items={items} value={value} onValueChange={(next) => next && onChange(next)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ConversionsSection({ settings }: Readonly<{ settings: GradingSettings }>) {
  const t = useTranslations("gradingSettings.conversions");
  const errorMessage = useApiErrorMessage();
  const scales = settings.scales.data ?? [];
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [tryValue, setTryValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const from = scales.find((scale) => scale.id === fromId);
  const to = scales.find((scale) => scale.id === toId);
  const preview = useMutation({
    mutationFn: () => api.grading.convert({ fromScaleId: fromId!, toScaleId: toId!, value: tryValue }).then((r) => r.data),
  });

  const choose = (nextFrom: string | null, nextTo: string | null) => {
    setFromId(nextFrom);
    setToId(nextTo);
    setError(null);
    preview.reset();
    const source = scales.find((scale) => scale.id === nextFrom);
    const existing = settings.conversions.data?.find(
      (conversion) => conversion.fromScaleId === nextFrom && conversion.toScaleId === nextTo,
    );
    if (source && !isNumericScale(source.definition)) {
      setRows((source.definition.levels ?? []).map((level) => ({ source: level.code, target: existing?.mapping[level.code] ?? "" })));
    } else {
      setRows(Object.entries(existing?.mapping ?? {}).map(([sourceValue, target]) => ({ source: sourceValue, target })));
    }
  };

  const save = () => {
    if (!fromId || !toId) return;
    const mapping = Object.fromEntries(rows.filter((row) => row.source.trim() && row.target.trim()).map((row) => [row.source.trim(), row.target.trim()]));
    settings.saveConversion.mutate(
      { fromScaleId: fromId, toScaleId: toId, mapping },
      { onSuccess: () => toast.success(t("saved")), onError: (saveError) => setError(errorMessage(saveError)) },
    );
  };

  const byMastery = (source: string) => {
    if (!from || !to) return "";
    const mastery = toMastery(from.definition, source);
    return mastery === null ? "" : fromMastery(to.definition, mastery);
  };
  const targetItems = to && !isNumericScale(to.definition)
    ? (to.definition.levels ?? []).map((level) => ({ value: level.code, label: level.code }))
    : null;

  return (
    <section aria-labelledby="conversions-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="conversions-title" className="text-lg font-semibold tracking-tight">
          {t("title")}
        </h2>
        <p className="text-muted-foreground max-w-prose text-sm">{t("description")}</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <ScaleSelect id="conversion-from" label={t("from")} scales={scales} value={fromId} onChange={(id) => choose(id, toId)} />
        <ScaleSelect
          id="conversion-to"
          label={t("to")}
          scales={scales.filter((scale) => scale.id !== fromId)}
          value={toId}
          onChange={(id) => choose(fromId, id)}
        />
      </div>
      <FormAlert message={error} />
      {!from || !to ? (
        <p className="text-muted-foreground text-sm">{t("pickScales")}</p>
      ) : (
        <div className="bg-card flex flex-col gap-4 rounded-lg border p-4">
          {isNumericScale(from.definition) && <p className="text-muted-foreground text-sm">{t("numericNote")}</p>}
          <ul className="flex flex-col gap-2">
            {rows.map((row, index) => (
              <li key={index} className="grid grid-cols-[6rem_1fr_auto] items-center gap-3">
                {isNumericScale(from.definition) ? (
                  <Input
                    aria-label={`${from.name} ${index + 1}`}
                    inputMode="decimal"
                    value={row.source}
                    onChange={(event) =>
                      setRows((current) => current.map((entry, position) => (position === index ? { ...entry, source: event.target.value } : entry)))
                    }
                  />
                ) : (
                  <span className="font-medium">{row.source}</span>
                )}
                {targetItems ? (
                  <Select
                    items={[{ value: "", label: t("byMastery", { value: byMastery(row.source) }) }, ...targetItems]}
                    value={row.target}
                    onValueChange={(value) =>
                      setRows((current) => current.map((entry, position) => (position === index ? { ...entry, target: value ?? "" } : entry)))
                    }
                  >
                    <SelectTrigger aria-label={`${t("target")} ${row.source}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[{ value: "", label: t("byMastery", { value: byMastery(row.source) }) }, ...targetItems].map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    aria-label={`${t("target")} ${row.source}`}
                    inputMode="decimal"
                    placeholder={t("byMastery", { value: byMastery(row.source) })}
                    value={row.target}
                    onChange={(event) =>
                      setRows((current) => current.map((entry, position) => (position === index ? { ...entry, target: event.target.value } : entry)))
                    }
                  />
                )}
                {isNumericScale(from.definition) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("removeValue", { value: row.source })}
                    onClick={() => setRows((current) => current.filter((_, position) => position !== index))}
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {isNumericScale(from.definition) && (
              <Button type="button" variant="outline" size="sm" onClick={() => setRows((current) => [...current, { source: "", target: "" }])}>
                <PlusIcon aria-hidden />
                {t("addValue")}
              </Button>
            )}
            <Button type="button" disabled={settings.saveConversion.isPending} onClick={save}>
              {t("save")}
            </Button>
          </div>
          <form
            className="flex flex-wrap items-end gap-3 border-t pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (tryValue.trim()) preview.mutate();
            }}
          >
            <div className="flex w-full flex-col gap-1.5 sm:w-40">
              <Label htmlFor="conversion-try">{t("tryLabel", { scale: from.name })}</Label>
              <Input id="conversion-try" value={tryValue} onChange={(event) => setTryValue(event.target.value)} />
            </div>
            <Button type="submit" variant="secondary">
              {t("try")}
            </Button>
            <p className="text-sm" aria-live="polite">
              {preview.data && t("result", { value: String(preview.data.value) })}
              {preview.error && <span className="text-destructive">{errorMessage(preview.error)}</span>}
            </p>
          </form>
        </div>
      )}
    </section>
  );
}
