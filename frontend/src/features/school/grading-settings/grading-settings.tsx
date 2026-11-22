"use client";

import { useTranslations } from "next-intl";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { isNumericScale } from "@/common/lib/grading";
import { FormAlert } from "@/components/form/form-alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConversionsSection } from "./conversions-section";
import { PoliciesSection } from "./policies-section";
import { ScaleEditorDialog } from "./scale-editor-dialog";
import { useGradingSettings } from "./use-grading-settings";

export function GradingSettings() {
  const t = useTranslations("gradingSettings.scales");
  const errorMessage = useApiErrorMessage();
  const settings = useGradingSettings();
  const presets = settings.presets.data ?? [];

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="scales-title" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="scales-title" className="text-lg font-semibold tracking-tight">
              {t("title")}
            </h2>
            <p className="text-muted-foreground max-w-prose text-sm">{t("description")}</p>
          </div>
          <ScaleEditorDialog presets={presets} onSave={(input) => settings.createScale.mutateAsync(input)} />
        </div>
        <FormAlert message={settings.scales.error ? errorMessage(settings.scales.error) : null} />
        {settings.scales.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : settings.scales.data?.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        ) : (
          <ul className="bg-card divide-y rounded-lg border">
            {(settings.scales.data ?? []).map((scale) => (
              <li key={scale.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-medium">{scale.name}</span>
                  <span className="text-muted-foreground text-sm">
                    {t(`kinds.${scale.kind}`)}
                    {" · "}
                    {isNumericScale(scale.definition)
                      ? t("outOf", { max: scale.definition.maxPoints ?? 100 })
                      : (scale.definition.levels ?? []).map((level) => level.code).join(" · ")}
                  </span>
                </div>
                <Badge variant="outline" className="tabular-nums">
                  {t("version", { version: scale.version })}
                </Badge>
                <ScaleEditorDialog
                  presets={presets}
                  scale={scale}
                  onSave={(input) => settings.updateScale.mutateAsync({ id: scale.id, ...input })}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
      <ConversionsSection settings={settings} />
      <PoliciesSection settings={settings} />
    </div>
  );
}
