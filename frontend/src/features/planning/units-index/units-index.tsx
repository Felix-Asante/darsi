"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useHasRole } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { Link, useRouter } from "@/common/i18n/navigation";
import { getMyUnitsQueryOptions } from "@/common/integrations/tanstack-query/query-options/planning";
import { formatCalendarDate } from "@/common/lib/format";
import { api } from "@/common/service/api";
import { FormAlert } from "@/components/form/form-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateUnitDialog } from "./create-unit-dialog";

export function UnitsIndex() {
  const t = useTranslations("planning");
  const locale = useLocale();
  const router = useRouter();
  const errorMessage = useApiErrorMessage();
  const canCreate = useHasRole("teacher");
  const units = useQuery(getMyUnitsQueryOptions());

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>
        {canCreate && (
          <CreateUnitDialog
            onCreate={async (input) => {
              const { data } = await api.planning.create(input);
              toast.success(t("unitForm.created", { title: data.title }));
              router.push(`/planning/units/${data.id}`);
            }}
          />
        )}
      </div>
      <FormAlert message={units.error ? errorMessage(units.error) : null} />
      {units.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : units.data?.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {(units.data ?? []).map((unit) => (
            <li key={unit.id}>
              <Link href={`/planning/units/${unit.id}`} className="bg-card hover:border-primary/40 flex flex-col gap-1 rounded-lg border p-4">
                <span className="font-medium">{unit.title}</span>
                <span className="text-muted-foreground text-sm">{unit.classes.map((schoolClass) => schoolClass.name).join(", ")}</span>
                <span className="text-muted-foreground text-sm tabular-nums">
                  {unit.startsOn && unit.endsOn
                    ? `${t("dates", { from: formatCalendarDate(unit.startsOn, locale), to: formatCalendarDate(unit.endsOn, locale) })} · `
                    : ""}
                  {t("lessons", { count: unit.lessonCount })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
