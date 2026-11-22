"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useCurrentSchool, useHasRole } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { getStudentGradesQueryOptions } from "@/common/integrations/tanstack-query/query-options/assessment";
import { getOwnStudentsQueryOptions } from "@/common/integrations/tanstack-query/query-options/people";
import { formatCalendarDate, formatDate } from "@/common/lib/format";
import { FormAlert } from "@/components/form/form-alert";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/common/i18n/navigation";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { AttachmentList } from "@/components/files/attachment-list";
import { UploadButton } from "@/components/files/upload-button";
import { SubmissionForm } from "./submission-form";

export function StudentGrades() {
  const t = useTranslations("assessment.grades");
  const tDrive = useTranslations("files.drive");
  const queryClient = useQueryClient();
  const tList = useTranslations("assessment.list");
  const format = useFormatter();
  const locale = useLocale();
  const school = useCurrentSchool();
  const errorMessage = useApiErrorMessage();
  const isStudent = useHasRole("student");
  const own = useQuery(getOwnStudentsQueryOptions());
  const [chosen, setChosen] = useState<string | null>(null);
  const studentId = chosen ?? own.data?.[0]?.id ?? "";
  const grades = useQuery(getStudentGradesQueryOptions(studentId));
  const childItems = (own.data ?? []).map((child) => ({
    value: child.id,
    label: `${child.preferredName ?? child.firstName} ${child.lastName}`,
  }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>
      {childItems.length > 1 && (
        <div className="flex w-full flex-col gap-1.5 sm:w-72">
          <Label htmlFor="grades-child">{t("child")}</Label>
          <Select items={childItems} value={studentId} onValueChange={(value) => setChosen(value)}>
            <SelectTrigger id="grades-child" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {childItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <FormAlert message={(own.error ?? grades.error) ? errorMessage(own.error ?? grades.error) : null} />
      {own.isSuccess && childItems.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noClasses")}</p>
      ) : grades.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : grades.data?.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noClasses")}</p>
      ) : (
        (grades.data ?? []).map((entry) => (
          <section
            key={entry.class.id}
            aria-labelledby={`class-${entry.class.id}`}
            className="bg-card flex flex-col gap-3 rounded-lg border p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id={`class-${entry.class.id}`} className="text-base font-semibold tracking-tight">
                {entry.class.name}
              </h2>
              <Link href={`/classes/${entry.class.id}/drive`} className="text-primary text-sm font-medium hover:underline">
                {tDrive("open")}
                <span className="sr-only">: {entry.class.name}</span>
              </Link>
              <p className="text-sm">
                <span className="text-muted-foreground">{t("result")}: </span>
                <span className="font-semibold tabular-nums">
                  {entry.result.mastery === null
                    ? t("noResult")
                    : entry.result.value && entry.reportingScale
                      ? t("resultOn", { value: entry.result.value, scale: entry.reportingScale.name })
                      : format.number(entry.result.mastery, { style: "percent", maximumFractionDigits: 0 })}
                </span>
              </p>
            </div>
            {entry.assessments.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("noAssessments")}</p>
            ) : (
              <ul className="divide-y">
                {entry.assessments.map((assessment) => (
                  <li key={assessment.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="min-w-0 flex-1 font-medium">{assessment.title}</span>
                      <Badge variant="outline">{tList(`kinds.${assessment.kind}`)}</Badge>
                      {assessment.dueOn && (
                        <span className="text-muted-foreground text-sm tabular-nums">
                          {t("due", { date: formatCalendarDate(assessment.dueOn, locale) })}
                        </span>
                      )}
                      <span className="font-semibold tabular-nums">
                        {assessment.grade
                          ? assessment.grade.excused
                            ? t("excused")
                            : assessment.grade.value
                          : <span className="text-muted-foreground font-normal">{t("notGraded")}</span>}
                      </span>
                    </div>
                    {assessment.grade?.reported && entry.reportingScale && (
                      <p className="text-muted-foreground text-sm">
                        {t("reportedAs", { value: assessment.grade.reported, scale: entry.reportingScale.name })}
                      </p>
                    )}
                    {assessment.grade?.comment && (
                      <blockquote className="border-s-2 ps-3 text-sm">
                        <span className="text-muted-foreground block text-xs">{t("comment")}</span>
                        {assessment.grade.comment}
                      </blockquote>
                    )}
                    {assessment.submission && (
                      <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
                        {t("submittedOn", { date: formatDate(assessment.submission.submittedAt, locale, school.timeZone) })}
                        {assessment.submission.isLate && <Badge variant="warning">{t("late")}</Badge>}
                      </p>
                    )}
                    <AttachmentList targetType="assessment" targetId={assessment.id} />
                    {isStudent && !assessment.grade && (
                      <>
                        <SubmissionForm assessmentId={assessment.id} initial={assessment.submission?.body ?? ""} />
                        <UploadButton
                          variant="outline"
                          multiple={false}
                          label={t("uploadWork")}
                          target={{ type: "submission", assessmentId: assessment.id }}
                          onUploaded={() => queryClient.invalidateQueries({ queryKey: queryKeys.assessment.all() })}
                        />
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}
    </div>
  );
}
