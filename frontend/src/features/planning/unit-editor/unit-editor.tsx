"use client";

import { useQueries } from "@tanstack/react-query";
import { ArrowLeftIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { Link, useRouter } from "@/common/i18n/navigation";
import { getClassAssessmentsQueryOptions } from "@/common/integrations/tanstack-query/query-options/assessment";
import { formatCalendarDate } from "@/common/lib/format";
import type { PlanTemplate, UnitPlan } from "@/common/types/daily";
import type { RichTextNode } from "@/common/types/rich-text";
import { AttachmentList } from "@/components/files/attachment-list";
import { AttachmentPicker } from "@/components/files/attachment-picker";
import { FormAlert } from "@/components/form/form-alert";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { RichTextView } from "@/components/rich-text/rich-text-view";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyDialog } from "./copy-dialog";
import { LessonDialog } from "./lesson-dialog";
import { SharingSection } from "./sharing-section";
import { type UnitHandle, useUnit } from "./use-unit";

export function UnitEditor({ unitId }: Readonly<{ unitId: string }>) {
  const errorMessage = useApiErrorMessage();
  const handle = useUnit(unitId);
  const { unit } = handle;
  if (unit.isPending) return <Skeleton className="mx-auto h-96 w-full max-w-5xl" />;
  if (unit.isError) return <FormAlert message={errorMessage(unit.error)} />;
  const template = handle.templates.data?.find((candidate) => candidate.id === unit.data.templateId) ?? null;
  return <UnitView key={unit.dataUpdatedAt} unit={unit.data} template={template} handle={handle} />;
}

function UnitView({ unit, template, handle }: Readonly<{ unit: UnitPlan; template: PlanTemplate | null; handle: UnitHandle }>) {
  const t = useTranslations("planning.unit");
  const tForm = useTranslations("planning.unitForm");
  const locale = useLocale();
  const format = useFormatter();
  const router = useRouter();
  const errorMessage = useApiErrorMessage();
  const canEdit = unit.access !== "viewer";
  const [title, setTitle] = useState(unit.title);
  const [startsOn, setStartsOn] = useState(unit.startsOn ?? "");
  const [endsOn, setEndsOn] = useState(unit.endsOn ?? "");
  const [objectives, setObjectives] = useState<RichTextNode | null>(unit.objectives);
  const [fields, setFields] = useState(unit.fieldValues);
  const [linked, setLinked] = useState(unit.assessmentIds);
  const classAssessments = useQueries({ queries: unit.classes.map((schoolClass) => getClassAssessmentsQueryOptions(schoolClass.id)) });
  const assessments = classAssessments.flatMap((query) => query.data ?? []);

  const save = () =>
    handle.update.mutate(
      {
        title: title.trim() || unit.title,
        templateId: unit.templateId,
        startsOn: startsOn || null,
        endsOn: endsOn || null,
        objectives,
        fieldValues: fields,
        classIds: unit.classes.map((schoolClass) => schoolClass.id),
        standardIds: unit.standardIds,
      },
      { onSuccess: () => toast.success(t("saved")) },
    );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Link href="/planning" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeftIcon aria-hidden className="size-4" />
        {t("back")}
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">{unit.title}</h1>
          <p className="text-muted-foreground text-sm">
            {unit.classes.map((schoolClass) => schoolClass.name).join(", ")}
            {unit.updatedBy && ` · ${t("lastEdited", { name: unit.updatedBy.name })}, ${format.relativeTime(new Date(unit.updatedAt))}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyDialog handle={handle} />
          {unit.access === "owner" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                handle.remove.mutate(undefined, {
                  onSuccess: () => {
                    toast.success(t("deleted"));
                    router.push("/planning");
                  },
                })
              }
            >
              <Trash2Icon aria-hidden />
              {t("delete")}
            </Button>
          )}
        </div>
      </header>
      {!canEdit && <p className="bg-info/10 text-info rounded-md px-3 py-2 text-sm">{t("readOnly")}</p>}
      <FormAlert message={handle.update.error ? errorMessage(handle.update.error) : null} />

      <section className="bg-card flex flex-col gap-4 rounded-lg border p-4 sm:p-5">
        {canEdit ? (
          <>
            <div className="grid gap-4 sm:grid-cols-[1fr_10rem_10rem]">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="unit-title">{tForm("name")}</Label>
                <Input id="unit-title" value={title} onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="unit-start">{tForm("startsOn")}</Label>
                <Input id="unit-start" type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="unit-end">{tForm("endsOn")}</Label>
                <Input id="unit-end" type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unit-objectives">{t("objectives")}</Label>
              <RichTextEditor id="unit-objectives" label={t("objectives")} value={objectives} onChange={setObjectives} />
            </div>
            {template?.fields.map((field) => (
              <div key={field.key} className="flex flex-col gap-1.5">
                <Label htmlFor={`field-${field.key}`}>{field.label}</Label>
                {field.kind === "text" ? (
                  <Input
                    id={`field-${field.key}`}
                    value={typeof fields[field.key] === "string" ? (fields[field.key] as string) : ""}
                    onChange={(event) => setFields((current) => ({ ...current, [field.key]: event.target.value }))}
                  />
                ) : (
                  <RichTextEditor
                    id={`field-${field.key}`}
                    label={field.label}
                    minHeight="sm"
                    value={typeof fields[field.key] === "object" ? (fields[field.key] as RichTextNode) : null}
                    onChange={(doc) => setFields((current) => ({ ...current, [field.key]: doc }))}
                  />
                )}
              </div>
            ))}
            <Button className="self-start" disabled={handle.update.isPending} onClick={save}>
              {t("save")}
            </Button>
          </>
        ) : (
          <>
            <h2 className="text-base font-semibold">{t("objectives")}</h2>
            <RichTextView doc={unit.objectives} />
            {template?.fields.map((field) => (
              <div key={field.key} className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold">{field.label}</h3>
                {typeof unit.fieldValues[field.key] === "string" ? (
                  <p className="text-sm">{unit.fieldValues[field.key] as string}</p>
                ) : (
                  <RichTextView doc={unit.fieldValues[field.key] as RichTextNode} />
                )}
              </div>
            ))}
          </>
        )}
      </section>

      <section aria-labelledby="lessons-title" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="lessons-title" className="text-base font-semibold">
            {t("lessons")}
          </h2>
          {canEdit && (
            <LessonDialog
              trigger={
                <Button size="sm">
                  <PlusIcon aria-hidden />
                  {t("addLesson")}
                </Button>
              }
              onSave={(input) => handle.saveLesson.mutateAsync(input)}
            />
          )}
        </div>
        {unit.lessons.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noLessons")}</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {unit.lessons.map((lesson) => (
              <li key={lesson.id} className="bg-card flex flex-col gap-2 rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h3 className="min-w-0 flex-1 font-semibold">{lesson.title}</h3>
                  {lesson.date && <span className="text-muted-foreground text-sm tabular-nums">{formatCalendarDate(lesson.date, locale)}</span>}
                  {canEdit && (
                    <>
                      <LessonDialog
                        lesson={lesson}
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label={t("editLesson", { title: lesson.title })}>
                            <PencilIcon aria-hidden />
                          </Button>
                        }
                        onSave={(input) => handle.saveLesson.mutateAsync({ ...input, lessonId: lesson.id })}
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("deleteLesson", { title: lesson.title })}
                        onClick={() => handle.removeLesson.mutate(lesson.id)}
                      >
                        <Trash2Icon aria-hidden />
                      </Button>
                    </>
                  )}
                </div>
                {(["objectives", "activities", "resources"] as const).map(
                  (field) =>
                    lesson[field] && (
                      <div key={field} className="flex flex-col gap-1">
                        <span className="text-muted-foreground text-xs font-medium uppercase">{t(field)}</span>
                        <RichTextView doc={lesson[field]} />
                      </div>
                    ),
                )}
                <AttachmentList targetType="lesson" targetId={lesson.id} />
                {canEdit && unit.classes[0] && (
                  <div>
                    <AttachmentPicker classId={unit.classes[0].id} targetType="lesson" targetId={lesson.id} />
                  </div>
                )}
                {lesson.updatedBy && (
                  <p className="text-muted-foreground text-xs">{t("lastEdited", { name: lesson.updatedBy.name })}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {canEdit && assessments.length > 0 && (
        <section aria-labelledby="linked-title" className="bg-card flex flex-col gap-3 rounded-lg border p-4">
          <h2 id="linked-title" className="text-base font-semibold">
            {t("assessments")}
          </h2>
          {assessments.map((assessment) => (
            <label key={assessment.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={linked.includes(assessment.id)}
                onCheckedChange={(checked) =>
                  setLinked((current) => (checked === true ? [...current, assessment.id] : current.filter((id) => id !== assessment.id)))
                }
              />
              {assessment.title}
            </label>
          ))}
          <Button
            variant="secondary"
            className="self-start"
            disabled={handle.linkAssessments.isPending}
            onClick={() => handle.linkAssessments.mutate(linked, { onSuccess: () => toast.success(t("saved")) })}
          >
            {t("saveAssessments")}
          </Button>
        </section>
      )}

      {unit.access === "owner" && <SharingSection unit={unit} handle={handle} />}
    </div>
  );
}
