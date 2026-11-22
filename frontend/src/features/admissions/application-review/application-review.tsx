"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentSchool, useHasRole } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { Link } from "@/common/i18n/navigation";
import {
  getApplicationQueryOptions,
  getStagesQueryOptions,
} from "@/common/integrations/tanstack-query/query-options/admissions";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { addDays, todayIn } from "@/common/lib/calendar-date";
import { formatCalendarDate, formatDateTime } from "@/common/lib/format";
import { api } from "@/common/service/api";
import type { StaffApplication } from "@/common/types/admissions";
import { FileOpener } from "@/components/files/file-opener";
import { FormAlert } from "@/components/form/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { localizedLabel } from "../_shared/localized-label";
import { StageBadge } from "../_shared/stage-badge";

/** One application for the admissions office: answers, documents, staff notes and the next step (ADMS-6–ADMS-9). */
export function ApplicationReview({
  applicationId,
}: Readonly<{ applicationId: string }>) {
  const t = useTranslations("admissions.review");
  const tForm = useTranslations("admissions.form");
  const tRelationship = useTranslations("admissions.relationships");
  const locale = useLocale();
  const errorMessage = useApiErrorMessage();
  const application = useQuery(getApplicationQueryOptions(applicationId));
  const manages = useHasRole("admissions_officer");

  if (application.error)
    return <FormAlert message={errorMessage(application.error)} />;
  if (!application.data) return <Skeleton className="h-96 w-full" />;
  const data = application.data;
  const name = [data.student.firstName, data.student.lastName]
    .filter(Boolean)
    .join(" ");
  const answer = (value: string | boolean | undefined) =>
    value === true ? t("yes") : value === false ? t("no") : value || "—";

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="flex flex-wrap items-center gap-3 text-xl font-semibold tracking-tight">
            {name}
            {data.stage && <StageBadge stage={data.stage} />}
          </h1>
          <p className="text-muted-foreground text-sm">
            {data.gradeLevel.name} · {data.cycle.name}
          </p>
        </div>
        {data.studentId && (
          <p className="bg-success/10 text-success rounded-lg px-3 py-2 text-sm">
            {t("enrolled")}{" "}
            <Link
              href={`/students/${data.studentId}`}
              className="font-medium underline"
            >
              {t("openRecord")}
            </Link>
          </p>
        )}
        {data.offer && (
          <p className="text-sm">
            {data.offer.response
              ? t(`offer.${data.offer.response}`)
              : t("offer.open", {
                  date: data.offer.expiresOn
                    ? formatCalendarDate(data.offer.expiresOn, locale, "long")
                    : "—",
                })}
          </p>
        )}

        <dl className="bg-card grid gap-x-6 gap-y-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
          <Item
            label={tForm("fields.studentDateOfBirth")}
            value={
              data.student.dateOfBirth
                ? formatCalendarDate(data.student.dateOfBirth, locale)
                : "—"
            }
          />
          <Item
            label={tForm("fields.studentPreferredName")}
            value={data.student.preferredName ?? "—"}
          />
          <Item
            label={t("guardian")}
            value={`${data.guardian.firstName ?? ""} ${data.guardian.lastName ?? ""}${data.guardian.relationship ? ` (${tRelationship(data.guardian.relationship)})` : ""}`}
          />
          <Item
            label={t("contact")}
            value={[data.guardianEmail, data.guardian.phone]
              .filter(Boolean)
              .join(" · ")}
          />
          {data.form.fields.map((field) => (
            <Item
              key={field.key}
              label={localizedLabel(field.label, locale)}
              value={answer(data.answers[field.key])}
            />
          ))}
        </dl>

        <section
          aria-labelledby="review-documents"
          className="flex flex-col gap-2"
        >
          <h2 id="review-documents" className="font-medium">
            {tForm("documents")}
          </h2>
          {data.documents.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noDocuments")}</p>
          ) : (
            <ul className="bg-card divide-y rounded-lg border">
              {data.documents.map((document) => {
                const label = data.form.documents.find(
                  (entry) => entry.key === document.key,
                )?.label;
                return (
                  <li
                    key={document.key}
                    className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm"
                  >
                    <span className="min-w-0 flex-1">
                      {label ? localizedLabel(label, locale) : document.key}
                    </span>
                    <FileOpener file={document.file} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <Notes application={data} canWrite={manages} />
      </div>
      {manages && !data.studentId && <NextStep application={data} />}
    </div>
  );
}

function Item({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}

function NextStep({
  application,
}: Readonly<{ application: StaffApplication }>) {
  const t = useTranslations("admissions.review");
  const school = useCurrentSchool();
  const queryClient = useQueryClient();
  const errorMessage = useApiErrorMessage();
  const stages = useQuery(getStagesQueryOptions());
  const [stageId, setStageId] = useState("");
  const [expiresOn, setExpiresOn] = useState(() =>
    addDays(todayIn(school.timeZone), 14),
  );
  const target = stages.data?.find((stage) => stage.id === stageId);
  const options = (stages.data ?? []).filter(
    (stage) => stage.id !== application.stage?.id && stage.kind !== "enrolled",
  );
  const move = useMutation({
    mutationFn: () =>
      api.admissions.move(
        application.id,
        stageId,
        target?.kind === "offered" ? expiresOn : undefined,
      ),
    onSuccess: async () => {
      toast.success(t("moved", { stage: target?.name ?? "" }));
      setStageId("");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.admissions.all(),
      });
    },
  });

  return (
    <aside className="flex flex-col gap-4">
      <form
        className="bg-card flex flex-col gap-4 rounded-lg border p-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (stageId) move.mutate();
        }}
      >
        <h2 className="font-medium">{t("nextStep")}</h2>
        <FormAlert message={move.error ? errorMessage(move.error) : null} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="review-stage">{t("moveTo")}</Label>
          <Select
            items={options.map((stage) => ({
              value: stage.id,
              label: stage.name,
            }))}
            value={stageId || null}
            onValueChange={(next) => next && setStageId(next)}
          >
            <SelectTrigger id="review-stage" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  {stage.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {target?.kind === "offered" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="review-expiry">{t("offerExpiry")}</Label>
            <Input
              id="review-expiry"
              type="date"
              value={expiresOn}
              onChange={(event) => setExpiresOn(event.target.value)}
            />
          </div>
        )}
        {target?.email && (
          <p className="text-muted-foreground text-xs">{t("emailNotice")}</p>
        )}
        {target?.kind === "accepted" && (
          <p className="text-muted-foreground text-xs">{t("acceptNotice")}</p>
        )}
        <Button type="submit" disabled={!stageId || move.isPending}>
          {t("move")}
        </Button>
      </form>
    </aside>
  );
}

function Notes({
  application,
  canWrite,
}: Readonly<{ application: StaffApplication; canWrite: boolean }>) {
  const t = useTranslations("admissions.review");
  const locale = useLocale();
  const school = useCurrentSchool();
  const queryClient = useQueryClient();
  const errorMessage = useApiErrorMessage();
  const [kind, setKind] = useState<"note" | "rating" | "interview">("note");
  const [body, setBody] = useState("");
  const [rating, setRating] = useState("3");
  const add = useMutation({
    mutationFn: () =>
      api.admissions.addNote(application.id, {
        kind,
        body: body.trim(),
        ...(kind === "rating" ? { rating: Number(rating) } : {}),
      }),
    onSuccess: async () => {
      setBody("");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.admissions.all(),
      });
    },
  });
  const kinds = (["note", "interview", "rating"] as const).map((value) => ({
    value,
    label: t(`noteKinds.${value}`),
  }));

  return (
    <section aria-labelledby="review-notes" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="review-notes" className="font-medium">
          {t("notes")}
        </h2>
        <p className="text-muted-foreground text-xs">{t("notesPrivate")}</p>
      </div>
      {application.notes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {application.notes.map((note) => (
            <li
              key={note.id}
              className="bg-card flex flex-col gap-1 rounded-lg border p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">{t(`noteKinds.${note.kind}`)}</Badge>
                {note.rating !== null && (
                  <span className="tabular-nums">
                    {t("ratingValue", { rating: note.rating })}
                  </span>
                )}
                <span className="text-muted-foreground">
                  {note.author} ·{" "}
                  {formatDateTime(note.createdAt, locale, school.timeZone)}
                </span>
              </div>
              <p className="whitespace-pre-line">{note.body}</p>
            </li>
          ))}
        </ul>
      )}
      {canWrite && (
        <form
          className="bg-card flex flex-col gap-3 rounded-lg border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (body.trim()) add.mutate();
          }}
        >
          <FormAlert message={add.error ? errorMessage(add.error) : null} />
          <div className="flex flex-wrap gap-3">
            <div className="flex w-40 flex-col gap-1.5">
              <Label htmlFor="note-kind">{t("noteKind")}</Label>
              <Select
                items={kinds}
                value={kind}
                onValueChange={(next) => next && setKind(next as typeof kind)}
              >
                <SelectTrigger id="note-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {kinds.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {kind === "rating" && (
              <div className="flex w-24 flex-col gap-1.5">
                <Label htmlFor="note-rating">{t("rating")}</Label>
                <Input
                  id="note-rating"
                  type="number"
                  min={1}
                  max={5}
                  value={rating}
                  onChange={(event) => setRating(event.target.value)}
                />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note-body">{t("note")}</Label>
            <Textarea
              id="note-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            className="self-start"
            disabled={add.isPending || !body.trim()}
          >
            {t("addNote")}
          </Button>
        </form>
      )}
    </section>
  );
}
