"use client";

import { ArrowLeftIcon, FileTextIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { Link } from "@/common/i18n/navigation";
import { formatCalendarDate } from "@/common/lib/format";
import { allowedValues, fromMastery, toMastery } from "@/common/lib/grading";
import { cn } from "@/common/lib/styles";
import type { Grade, GradeEntry, GradingSheet as Sheet } from "@/common/types/assessment";
import { getFieldErrors, isForbiddenError, isNotFoundError } from "@/common/utils/errors";
import { FormAlert } from "@/components/form/form-alert";
import { useValidationMessage } from "@/components/form/use-validation-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AttachmentList } from "@/components/files/attachment-list";
import { AttachmentPicker } from "@/components/files/attachment-picker";
import { SubmissionFile } from "./submission-file";
import { useGradingSheet } from "./use-grading-sheet";

interface Row {
  value: string;
  criterionValues: Record<string, string>;
  comment: string;
  excused: boolean;
}

const toRow = (grade: Grade | undefined): Row => ({
  value: grade?.value ?? "",
  criterionValues: grade?.criterionValues ?? {},
  comment: grade?.comment ?? "",
  excused: grade?.excused ?? false,
});

const sameRow = (a: Row, b: Row) => JSON.stringify(a) === JSON.stringify(b);

/** Enter moves to the same column on the next student, like a spreadsheet. */
function moveDown(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  const { row, col } = event.currentTarget.dataset;
  document.querySelector<HTMLInputElement>(`[data-row="${Number(row) + 1}"][data-col="${col}"]`)?.focus();
}

export function GradingSheet({ assessmentId }: Readonly<{ assessmentId: string }>) {
  const errorMessage = useApiErrorMessage();
  const grading = useGradingSheet(assessmentId);
  const { sheet } = grading;

  if (sheet.isPending) return <Skeleton className="mx-auto h-64 w-full max-w-6xl" />;
  if (sheet.isError) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        {isNotFoundError(sheet.error) || isForbiddenError(sheet.error) ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyDescription>{errorMessage(sheet.error)}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <FormAlert message={errorMessage(sheet.error)} />
        )}
      </div>
    );
  }
  // Remounting on new data resets the edits to what was saved.
  return <SheetEditor key={sheet.dataUpdatedAt} data={sheet.data} grading={grading} />;
}

const savedRows = (data: Sheet) =>
  Object.fromEntries(data.students.map((student) => [student.id, toRow(data.grades.find((grade) => grade.studentId === student.id))]));

function SheetEditor({ data, grading }: Readonly<{ data: Sheet; grading: ReturnType<typeof useGradingSheet> }>) {
  const t = useTranslations("assessment.grading");
  const tList = useTranslations("assessment.list");
  const locale = useLocale();
  const errorMessage = useApiErrorMessage();
  const validationMessage = useValidationMessage();
  const { save, publishAll } = grading;
  const [rows, setRows] = useState<Record<string, Row>>(() => savedRows(data));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const { assessment, students, grades, submissions, canPublish } = data;
  const original = savedRows(data);
  const dirty = students.filter((student) => rows[student.id] && !sameRow(rows[student.id], original[student.id]));
  const hasRubric = assessment.criteria.length > 0;
  const hasDrafts = grades.some((grade) => grade.status === "draft" && (grade.value !== null || grade.excused));
  const update = (studentId: string, patch: Partial<Row>) =>
    setRows((current) => ({ ...current, [studentId]: { ...current[studentId], ...patch } }));

  const submit = (publish: boolean) => {
    const changed = publish ? students.filter((student) => rows[student.id]) : dirty;
    const entries: GradeEntry[] = changed.map((student) => {
      const row = rows[student.id];
      return {
        studentId: student.id,
        ...(hasRubric ? { criterionValues: row.criterionValues } : { value: row.value || null }),
        comment: row.comment || null,
        excused: row.excused,
      };
    });
    setErrors({});
    setFormError(null);
    save.mutate(
      { grades: entries, publish },
      {
        onSuccess: () => toast.success(publish ? t("published") : t("saved")),
        onError: (error) => {
          const fields = getFieldErrors(error);
          const byStudent: Record<string, string> = {};
          for (const [field, codes] of Object.entries(fields)) {
            const [, index, ...rest] = field.split(".");
            const studentId = entries[Number(index)]?.studentId;
            if (studentId) byStudent[`${studentId}:${rest.join(".")}`] = validationMessage(codes[0]) ?? codes[0];
          }
          setErrors(byStudent);
          if (Object.keys(byStudent).length === 0) setFormError(errorMessage(error));
        },
      },
    );
  };

  const rubricResult = (row: Row) => {
    const results = assessment.criteria.flatMap((criterion) => {
      const mastery = toMastery(criterion.scale.definition, row.criterionValues[criterion.id] ?? "");
      return mastery === null ? [] : [{ mastery, weight: criterion.weight }];
    });
    const total = results.reduce((sum, result) => sum + result.weight, 0);
    if (results.length === 0 || total === 0) return "—";
    return fromMastery(assessment.scale.definition, results.reduce((sum, result) => sum + result.mastery * result.weight, 0) / total);
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <Link
        href={`/classes/${assessment.classId}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeftIcon aria-hidden className="size-4" />
        {t("back")}
      </Link>
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{assessment.title}</h1>
          <Badge variant="secondary">{tList(`kinds.${assessment.kind}`)}</Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          {assessment.scale.name}
          {" · "}
          {assessment.dueOn ? tList("due", { date: formatCalendarDate(assessment.dueOn, locale) }) : tList("noDue")}
        </p>
        {assessment.description && <p className="max-w-prose text-sm whitespace-pre-line">{assessment.description}</p>}
        <div className="flex flex-col items-start gap-2 pt-1">
          <AttachmentList targetType="assessment" targetId={assessment.id} />
          <AttachmentPicker classId={assessment.classId} targetType="assessment" targetId={assessment.id} />
        </div>
      </header>

      {!canPublish && <p className="bg-info/10 text-info rounded-md px-3 py-2 text-sm">{t("assistantNote")}</p>}
      <FormAlert message={formError} />

      {students.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noStudents")}</p>
      ) : (
        <div className="bg-card overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="bg-card sticky start-0 z-10 min-w-44">{t("student")}</TableHead>
                {hasRubric ? (
                  <>
                    {assessment.criteria.map((criterion) => (
                      <TableHead key={criterion.id} className="min-w-28">
                        <span className="block">{criterion.name}</span>
                        <span className="text-muted-foreground block text-xs font-normal">
                          {t("allowed", { codes: allowedValues(criterion.scale.definition) })}
                        </span>
                      </TableHead>
                    ))}
                    <TableHead>{t("rubric")}</TableHead>
                  </>
                ) : (
                  <TableHead className="min-w-28">
                    <span className="block">{t("value")}</span>
                    <span className="text-muted-foreground block text-xs font-normal">
                      {t("allowed", { codes: allowedValues(assessment.scale.definition) })}
                    </span>
                  </TableHead>
                )}
                <TableHead className="min-w-56">{t("comment")}</TableHead>
                <TableHead>{t("excused")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>
                  <span className="sr-only">{t("submitted")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student, rowIndex) => {
                const row = rows[student.id] ?? toRow(undefined);
                const grade = grades.find((candidate) => candidate.studentId === student.id);
                const submission = submissions.find((candidate) => candidate.studentId === student.id);
                const name = `${student.preferredName ?? student.firstName} ${student.lastName}`;
                const changed = dirty.includes(student);
                const error = (field: string) => errors[`${student.id}:${field}`];
                return (
                  <TableRow key={student.id} className={cn(changed && "bg-warning/5")}>
                    <TableCell className="bg-card sticky start-0 z-10 font-medium">
                      {student.lastName}, {student.preferredName ?? student.firstName}
                    </TableCell>
                    {hasRubric ? (
                      <>
                        {assessment.criteria.map((criterion, colIndex) => (
                          <TableCell key={criterion.id}>
                            <Input
                              aria-label={`${criterion.name}: ${name}`}
                              data-row={rowIndex}
                              data-col={colIndex}
                              className="w-20 tabular-nums"
                              value={row.criterionValues[criterion.id] ?? ""}
                              aria-invalid={Boolean(error(`criterionValues.${criterion.id}`))}
                              title={error(`criterionValues.${criterion.id}`)}
                              onKeyDown={moveDown}
                              onChange={(event) =>
                                update(student.id, { criterionValues: { ...row.criterionValues, [criterion.id]: event.target.value } })
                              }
                            />
                          </TableCell>
                        ))}
                        <TableCell className="font-medium tabular-nums">{rubricResult(row)}</TableCell>
                      </>
                    ) : (
                      <TableCell>
                        <Input
                          aria-label={`${t("value")}: ${name}`}
                          data-row={rowIndex}
                          data-col={0}
                          className="w-20 tabular-nums"
                          inputMode={assessment.scale.definition.kind === "points" || assessment.scale.definition.kind === "percentage" ? "decimal" : "text"}
                          value={row.value}
                          aria-invalid={Boolean(error("value"))}
                          aria-describedby={error("value") ? `error-${student.id}` : undefined}
                          onKeyDown={moveDown}
                          onChange={(event) => update(student.id, { value: event.target.value })}
                        />
                        {error("value") && (
                          <p id={`error-${student.id}`} className="text-destructive mt-1 text-xs">
                            {error("value")}
                          </p>
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      <Input
                        aria-label={`${t("comment")}: ${name}`}
                        data-row={rowIndex}
                        data-col="comment"
                        value={row.comment}
                        onKeyDown={moveDown}
                        onChange={(event) => update(student.id, { comment: event.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        aria-label={`${t("excused")}: ${name}`}
                        checked={row.excused}
                        onCheckedChange={(checked) => update(student.id, { excused: checked === true })}
                      />
                    </TableCell>
                    <TableCell>
                      {grade ? (
                        <Badge variant={grade.status === "published" ? "success" : "info"}>{t(`statuses.${grade.status}`)}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">{t("statuses.none")}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {submission && (
                        <Dialog>
                          <DialogTrigger
                            render={<Button variant="ghost" size="sm" />}
                          >
                            <FileTextIcon aria-hidden />
                            {submission.isLate ? (
                              <Badge variant="warning">{t("late")}</Badge>
                            ) : (
                              <span className="text-sm">{t("submitted")}</span>
                            )}
                            <span className="sr-only">{t("viewSubmission", { name })}</span>
                          </DialogTrigger>
                          <DialogContent className="max-h-[80dvh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>{t("viewSubmission", { name })}</DialogTitle>
                            </DialogHeader>
                            {submission.body && <p className="text-sm whitespace-pre-line">{submission.body}</p>}
                            {submission.fileId && <SubmissionFile fileId={submission.fileId} />}
                          </DialogContent>
                        </Dialog>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" disabled={dirty.length === 0 || save.isPending} onClick={() => submit(false)}>
          {t("saveDraft")}
        </Button>
        {canPublish && (
          <Button disabled={save.isPending} onClick={() => submit(true)}>
            {t("publish")}
          </Button>
        )}
        {canPublish && hasDrafts && dirty.length === 0 && (
          <Button
            variant="secondary"
            disabled={publishAll.isPending}
            onClick={() =>
              publishAll.mutate(undefined, {
                onSuccess: () => toast.success(t("published")),
                onError: (error) => setFormError(errorMessage(error)),
              })
            }
          >
            {t("publishAll")}
          </Button>
        )}
        {dirty.length > 0 && (
          <span className="text-warning text-sm" role="status">
            {t("unsaved")}
          </span>
        )}
      </div>
    </div>
  );
}
