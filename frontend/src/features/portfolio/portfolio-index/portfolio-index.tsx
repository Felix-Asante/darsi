"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { Link } from "@/common/i18n/navigation";
import { getOwnStudentsQueryOptions } from "@/common/integrations/tanstack-query/query-options/people";
import { FormAlert } from "@/components/form/form-alert";
import { Skeleton } from "@/components/ui/skeleton";

/** Students and families pick whose portfolio to open. */
export function PortfolioIndex() {
  const t = useTranslations("portfolio");
  const errorMessage = useApiErrorMessage();
  const students = useQuery(getOwnStudentsQueryOptions());

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
      <FormAlert message={students.error ? errorMessage(students.error) : null} />
      {students.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : students.data?.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noStudent")}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {(students.data ?? []).map((student) => (
            <li key={student.id}>
              <Link href={`/portfolio/${student.id}`} className="bg-card hover:border-primary/40 flex flex-col rounded-lg border p-4">
                <span className="font-medium">
                  {student.preferredName ?? student.firstName} {student.lastName}
                </span>
                {student.gradeLevel && <span className="text-muted-foreground text-sm">{student.gradeLevel.name}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
