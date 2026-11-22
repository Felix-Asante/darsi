"use client";

import { Trash2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { formatCalendarDate } from "@/common/lib/format";
import { FormAlert } from "@/components/form/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineForm } from "../_shared/inline-form";
import { useAcademicStructure } from "./use-academic-structure";

function Section({
  id,
  title,
  description,
  children,
}: Readonly<{ id: string; title: string; description: string; children: React.ReactNode }>) {
  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <p className="text-muted-foreground max-w-prose text-sm">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function AcademicStructure() {
  const t = useTranslations("academicSettings");
  const locale = useLocale();
  const errorMessage = useApiErrorMessage();
  const structure = useAcademicStructure();
  const { years, divisions, subjects } = structure;
  const loadError = years.error ?? divisions.error ?? subjects.error;
  const onError = (error: unknown) => toast.error(errorMessage(error));

  return (
    <div className="flex flex-col gap-10">
      <FormAlert message={loadError ? errorMessage(loadError) : null} />

      <Section id="years" title={t("years.title")} description={t("years.description")}>
        {years.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : years.data?.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("years.empty")}</p>
        ) : (
          <ul className="bg-card divide-y rounded-lg border">
            {(years.data ?? []).map((year) => (
              <li key={year.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{year.name}</span>
                  <span className="text-muted-foreground text-sm tabular-nums">
                    {formatCalendarDate(year.startsOn, locale)} – {formatCalendarDate(year.endsOn, locale)}
                  </span>
                </div>
                {year.isCurrent ? (
                  <Badge variant="success">{t("years.current")}</Badge>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={structure.makeCurrent.isPending}
                    onClick={() =>
                      structure.makeCurrent.mutate(year.id, {
                        onSuccess: () => toast.success(t("years.madeCurrent", { name: year.name })),
                        onError,
                      })
                    }
                  >
                    {t("years.makeCurrent")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <InlineForm
          id="new-year"
          submitLabel={t("years.add")}
          fields={[
            { name: "name", label: t("years.name"), placeholder: t("years.namePlaceholder") },
            { name: "startsOn", label: t("years.startsOn"), type: "date", className: "flex w-full flex-col gap-1.5 sm:w-44" },
            { name: "endsOn", label: t("years.endsOn"), type: "date", className: "flex w-full flex-col gap-1.5 sm:w-44" },
          ]}
          onSubmit={async ({ name, startsOn, endsOn }) => {
            const isCurrent = (years.data ?? []).every((year) => !year.isCurrent);
            await structure.createYear.mutateAsync({ name, startsOn, endsOn, isCurrent });
            toast.success(t("years.created", { name }));
          }}
        />
      </Section>

      <Section id="terms" title={t("terms.title")} description={t("terms.description")}>
        {!structure.currentYear ? (
          <p className="text-muted-foreground text-sm">{t("terms.noYear")}</p>
        ) : (
          <>
            {structure.terms.data?.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("terms.empty")}</p>
            ) : (
              <ul className="bg-card divide-y rounded-lg border">
                {(structure.terms.data ?? []).map((term) => (
                  <li key={term.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="flex-1 font-medium">{term.name}</span>
                    <span className="text-muted-foreground text-sm tabular-nums">
                      {formatCalendarDate(term.startsOn, locale)} – {formatCalendarDate(term.endsOn, locale)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("terms.deleteLabel", { name: term.name })}
                      disabled={structure.deleteTerm.isPending}
                      onClick={() => structure.deleteTerm.mutate(term.id, { onError })}
                    >
                      <Trash2Icon aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <InlineForm
              id="new-term"
              submitLabel={t("terms.add")}
              fields={[
                { name: "name", label: t("terms.name"), placeholder: t("terms.namePlaceholder") },
                { name: "startsOn", label: t("terms.startsOn"), type: "date", className: "flex w-full flex-col gap-1.5 sm:w-44" },
                { name: "endsOn", label: t("terms.endsOn"), type: "date", className: "flex w-full flex-col gap-1.5 sm:w-44" },
              ]}
              onSubmit={({ name, startsOn, endsOn }) =>
                structure.createTerm.mutateAsync({ yearId: structure.currentYear!.id, name, startsOn, endsOn })
              }
            />
          </>
        )}
      </Section>

      <Section id="divisions" title={t("divisions.title")} description={t("divisions.description")}>
        {divisions.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : divisions.data?.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("divisions.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {(divisions.data ?? []).map((division) => (
              <li key={division.id} className="bg-card flex flex-col gap-3 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{division.name}</h3>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("divisions.deleteDivision", { name: division.name })}
                    disabled={structure.deleteDivision.isPending}
                    onClick={() => structure.deleteDivision.mutate(division.id, { onError })}
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                </div>
                {division.gradeLevels.length === 0 ? (
                  <p className="text-muted-foreground text-sm">{t("divisions.noGrades")}</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {division.gradeLevels.map((level) => (
                      <li key={level.id} className="bg-muted inline-flex items-center gap-1 rounded-md py-0.5 ps-2.5 pe-0.5 text-sm">
                        {level.name}
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={t("divisions.deleteGrade", { name: level.name })}
                          disabled={structure.deleteGradeLevel.isPending}
                          onClick={() => structure.deleteGradeLevel.mutate(level.id, { onError })}
                        >
                          <Trash2Icon aria-hidden />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <InlineForm
                  id={`grade-${division.id}`}
                  submitLabel={t("divisions.addGrade")}
                  fields={[{ name: "name", label: t("divisions.gradeLabel", { division: division.name }) }]}
                  onSubmit={({ name }) => structure.createGradeLevel.mutateAsync({ divisionId: division.id, name })}
                />
              </li>
            ))}
          </ul>
        )}
        <InlineForm
          id="new-division"
          submitLabel={t("divisions.add")}
          fields={[{ name: "name", label: t("divisions.name") }]}
          onSubmit={({ name }) => structure.createDivision.mutateAsync(name)}
        />
      </Section>

      <Section id="subjects" title={t("subjects.title")} description={t("subjects.description")}>
        {subjects.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : subjects.data?.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("subjects.empty")}</p>
        ) : (
          <ul className="bg-card divide-y rounded-lg border">
            {(subjects.data ?? []).map((subject) => (
              <li key={subject.id} className="flex items-baseline gap-3 px-4 py-2.5">
                <code className="text-muted-foreground w-20 shrink-0 text-xs">{subject.code}</code>
                <span>{subject.name}</span>
              </li>
            ))}
          </ul>
        )}
        <InlineForm
          id="new-subject"
          submitLabel={t("subjects.add")}
          fields={[
            { name: "code", label: t("subjects.code"), className: "flex w-full flex-col gap-1.5 sm:w-32" },
            { name: "name", label: t("subjects.name") },
          ]}
          onSubmit={(values) => structure.createSubject.mutateAsync({ code: values.code, name: values.name })}
        />
      </Section>
    </div>
  );
}
