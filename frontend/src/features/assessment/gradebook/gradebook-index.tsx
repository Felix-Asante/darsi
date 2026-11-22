"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { Link } from "@/common/i18n/navigation";
import { getClassesQueryOptions } from "@/common/integrations/tanstack-query/query-options/academics";
import { FormAlert } from "@/components/form/form-alert";
import { Skeleton } from "@/components/ui/skeleton";

/** The classes the user teaches, each opening its gradebook. */
export function GradebookIndex() {
  const t = useTranslations("assessment.gradebook");
  const errorMessage = useApiErrorMessage();
  const classes = useQuery(getClassesQueryOptions({ mine: true }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("pickClass")}</p>
      </div>
      <FormAlert message={classes.error ? errorMessage(classes.error) : null} />
      {classes.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : classes.data?.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noClasses")}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(classes.data ?? []).map((schoolClass) => (
            <li key={schoolClass.id}>
              <Link
                href={`/classes/${schoolClass.id}/gradebook`}
                className="bg-card hover:border-primary/40 flex flex-col gap-1 rounded-lg border p-4"
              >
                <span className="font-medium">{schoolClass.name}</span>
                <span className="text-muted-foreground text-sm">
                  <code className="text-xs">{schoolClass.code}</code>
                  {schoolClass.subject && ` · ${schoolClass.subject.name}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
