"use client";

import { BookOpenCheckIcon, Trash2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useHasRole } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { Link } from "@/common/i18n/navigation";
import { formatCalendarDate } from "@/common/lib/format";
import { FormAlert } from "@/components/form/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateAssessmentDialog } from "./create-assessment-dialog";
import { useClassAssessments } from "./use-class-assessments";

/** The class's assessments, for its teachers and assistants. */
export function ClassAssessments({ classId }: Readonly<{ classId: string }>) {
  const t = useTranslations("assessment.list");
  const locale = useLocale();
  const errorMessage = useApiErrorMessage();
  const isTeachingStaff = useHasRole("teacher", "teaching_assistant", "coordinator");
  const canCreate = useHasRole("teacher");
  const { assessments, scales, categories, create, remove } = useClassAssessments(classId);

  if (!isTeachingStaff) return null;

  return (
    <section className="bg-card flex flex-col gap-3 rounded-lg border p-4 sm:p-5" aria-labelledby="assessments-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="assessments-title" className="text-base font-semibold tracking-tight">
          {t("title")}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/classes/${classId}/gradebook`} />}>
            <BookOpenCheckIcon aria-hidden />
            {t("gradebook")}
          </Button>
          {canCreate && (
            <CreateAssessmentDialog
              scales={scales.data ?? []}
              categories={categories}
              onCreate={(input) => create.mutateAsync(input)}
            />
          )}
        </div>
      </div>
      <FormAlert message={assessments.error ? errorMessage(assessments.error) : null} />
      {assessments.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : assessments.data?.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      ) : (
        <ul className="divide-y">
          {(assessments.data ?? []).map((assessment) => (
            <li key={assessment.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 first:pt-0 last:pb-0">
              <Link href={`/assessments/${assessment.id}`} className="min-w-0 flex-1 font-medium hover:underline">
                {assessment.title}
              </Link>
              <span className="text-muted-foreground text-sm tabular-nums">
                {assessment.dueOn ? t("due", { date: formatCalendarDate(assessment.dueOn, locale) }) : t("noDue")}
              </span>
              <Badge variant={assessment.kind === "summative" ? "secondary" : "outline"}>{t(`kinds.${assessment.kind}`)}</Badge>
              <span className="text-muted-foreground text-sm">{assessment.scale.name}</span>
              {canCreate && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("deleteLabel", { title: assessment.title })}
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(assessment.id, {
                      onSuccess: () => toast.success(t("deleted", { title: assessment.title })),
                      onError: (error) => toast.error(errorMessage(error)),
                    })
                  }
                >
                  <Trash2Icon aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
