"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StarIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useHasRole } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { Link } from "@/common/i18n/navigation";
import { getGradeLevelsQueryOptions } from "@/common/integrations/tanstack-query/query-options/academics";
import {
  getApplicationsQueryOptions,
  getCyclesQueryOptions,
  getPlacesQueryOptions,
  getStagesQueryOptions,
} from "@/common/integrations/tanstack-query/query-options/admissions";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { formatCalendarDate } from "@/common/lib/format";
import { api } from "@/common/service/api";
import type { ApplicationSummary, Stage } from "@/common/types/admissions";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StageBadge } from "../_shared/stage-badge";

const ALL = "all";

function Filter({
  id,
  label,
  value,
  onChange,
  items,
}: Readonly<{
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  items: { value: string; label: string }[];
}>) {
  return (
    <div className="flex w-full flex-col gap-1.5 sm:w-52">
      <Label htmlFor={id}>{label}</Label>
      <Select
        items={items}
        value={value}
        onValueChange={(next) => next && onChange(next)}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Applications by stage, as a board or a list, filtered by cycle, stage and grade (ADMS-6). */
export function AdmissionsBoard() {
  const t = useTranslations("admissions.board");
  const errorMessage = useApiErrorMessage();
  const cycles = useQuery(getCyclesQueryOptions());
  const stages = useQuery(getStagesQueryOptions());
  const grades = useQuery(getGradeLevelsQueryOptions());
  const [cycleId, setCycleId] = useState(ALL);
  const [stageId, setStageId] = useState(ALL);
  const [gradeLevelId, setGradeLevelId] = useState(ALL);
  const [view, setView] = useState<"board" | "list">("board");
  const query = {
    ...(cycleId !== ALL ? { cycleId } : {}),
    ...(stageId !== ALL ? { stageId } : {}),
    ...(gradeLevelId !== ALL ? { gradeLevelId } : {}),
  };
  const applications = useQuery(getApplicationsQueryOptions(query));
  const shownStages = (stages.data ?? []).filter(
    (stage) => stageId === ALL || stage.id === stageId,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground max-w-prose text-sm">
          {t("description")}
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <Filter
          id="filter-cycle"
          label={t("cycle")}
          value={cycleId}
          onChange={setCycleId}
          items={[
            { value: ALL, label: t("allCycles") },
            ...(cycles.data ?? []).map((cycle) => ({
              value: cycle.id,
              label: cycle.name,
            })),
          ]}
        />
        <Filter
          id="filter-stage"
          label={t("stage")}
          value={stageId}
          onChange={setStageId}
          items={[
            { value: ALL, label: t("allStages") },
            ...(stages.data ?? []).map((stage) => ({
              value: stage.id,
              label: stage.name,
            })),
          ]}
        />
        <Filter
          id="filter-grade"
          label={t("grade")}
          value={gradeLevelId}
          onChange={setGradeLevelId}
          items={[
            { value: ALL, label: t("allGrades") },
            ...(grades.data ?? []).map((grade) => ({
              value: grade.value,
              label: grade.label,
            })),
          ]}
        />
        <div role="group" aria-label={t("view")} className="flex gap-1">
          {(["board", "list"] as const).map((option) => (
            <Button
              key={option}
              variant={view === option ? "secondary" : "ghost"}
              aria-pressed={view === option}
              onClick={() => setView(option)}
            >
              {t(`views.${option}`)}
            </Button>
          ))}
        </div>
      </div>
      {cycleId !== ALL && <Places cycleId={cycleId} />}
      <FormAlert
        message={applications.error ? errorMessage(applications.error) : null}
      />
      {applications.isPending || stages.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : applications.data?.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("none")}</p>
      ) : view === "board" ? (
        <div
          className="flex gap-4 overflow-x-auto pb-2"
          role="region"
          aria-label={t("board")}
          tabIndex={0}
        >
          {shownStages.map((stage) => {
            const cards = (applications.data ?? []).filter(
              (application) => application.stageId === stage.id,
            );
            return (
              <section
                key={stage.id}
                aria-labelledby={`stage-${stage.id}`}
                className="bg-muted/40 flex w-72 shrink-0 flex-col gap-2 rounded-lg p-2"
              >
                <h2
                  id={`stage-${stage.id}`}
                  className="flex items-center justify-between px-1 text-sm font-medium"
                >
                  {stage.name}
                  <span className="text-muted-foreground tabular-nums">
                    {cards.length}
                  </span>
                </h2>
                {cards.map((application) => (
                  <Card
                    key={application.id}
                    application={application}
                    stages={stages.data ?? []}
                  />
                ))}
              </section>
            );
          })}
        </div>
      ) : (
        <ApplicationsTable
          applications={applications.data ?? []}
          stages={stages.data ?? []}
        />
      )}
    </div>
  );
}

function Places({ cycleId }: Readonly<{ cycleId: string }>) {
  const t = useTranslations("admissions.board");
  const places = useQuery(getPlacesQueryOptions(cycleId));
  const grades = useQuery(getGradeLevelsQueryOptions());
  if (!places.data) return null;
  return (
    <ul
      className="flex flex-wrap gap-x-6 gap-y-1 text-sm"
      aria-label={t("places")}
    >
      {places.data.grades.map((grade) => (
        <li key={grade.gradeLevelId} className="tabular-nums">
          {
            grades.data?.find((entry) => entry.value === grade.gradeLevelId)
              ?.label
          }
          :{" "}
          {t("placesLeft", {
            left: Math.max(0, grade.places - grade.taken),
            places: grade.places,
          })}
        </li>
      ))}
    </ul>
  );
}

const studentName = (application: ApplicationSummary) =>
  [application.student.firstName, application.student.lastName]
    .filter(Boolean)
    .join(" ");

/** A card moves through its stage menu, so the board works without dragging. */
function Card({
  application,
  stages,
}: Readonly<{ application: ApplicationSummary; stages: Stage[] }>) {
  const t = useTranslations("admissions.board");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const errorMessage = useApiErrorMessage();
  const manages = useHasRole("admissions_officer");
  // Offers need an expiry date, so they are made from the application page.
  const targets = stages.filter(
    (stage) =>
      stage.id !== application.stageId &&
      stage.kind !== "enrolled" &&
      stage.kind !== "offered",
  );
  const move = useMutation({
    mutationFn: (stageId: string) =>
      api.admissions.move(application.id, stageId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.admissions.all() }),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const name = studentName(application);
  return (
    <article className="bg-card flex flex-col gap-1.5 rounded-md border p-3 text-sm shadow-xs">
      <Link
        href={`/admissions/applications/${application.id}`}
        className="font-medium hover:underline"
      >
        {name}
      </Link>
      <span className="text-muted-foreground text-xs">
        {application.gradeLevel.name} ·{" "}
        {formatCalendarDate(application.submittedAt.slice(0, 10), locale)}
      </span>
      {application.rating !== null && (
        <span className="flex items-center gap-1 text-xs tabular-nums">
          <StarIcon aria-hidden className="size-3.5" />
          {t("rating", { rating: application.rating })}
        </span>
      )}
      {manages && targets.length > 0 && !application.studentId && (
        <Select
          items={targets.map((stage) => ({
            value: stage.id,
            label: stage.name,
          }))}
          value={null}
          onValueChange={(next) => next && move.mutate(next)}
        >
          <SelectTrigger
            size="sm"
            className="mt-1 w-full"
            aria-label={t("moveStudent", { student: name })}
          >
            <SelectValue placeholder={t("move")} />
          </SelectTrigger>
          <SelectContent>
            {targets.map((stage) => (
              <SelectItem key={stage.id} value={stage.id}>
                {stage.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </article>
  );
}

function ApplicationsTable({
  applications,
  stages,
}: Readonly<{ applications: ApplicationSummary[]; stages: Stage[] }>) {
  const t = useTranslations("admissions.board");
  const locale = useLocale();
  return (
    <div className="bg-card rounded-lg border">
      <Table label={t("title")}>
        <TableHeader>
          <TableRow>
            <TableHead>{t("student")}</TableHead>
            <TableHead>{t("grade")}</TableHead>
            <TableHead>{t("family")}</TableHead>
            <TableHead>{t("submitted")}</TableHead>
            <TableHead>{t("stage")}</TableHead>
            <TableHead className="text-end">{t("ratingHeader")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.map((application) => {
            const stage = stages.find(
              (entry) => entry.id === application.stageId,
            );
            return (
              <TableRow key={application.id}>
                <TableCell>
                  <Link
                    href={`/admissions/applications/${application.id}`}
                    className="font-medium hover:underline"
                  >
                    {studentName(application)}
                  </Link>
                </TableCell>
                <TableCell>{application.gradeLevel.name}</TableCell>
                <TableCell>{application.guardian.name}</TableCell>
                <TableCell className="tabular-nums">
                  {formatCalendarDate(
                    application.submittedAt.slice(0, 10),
                    locale,
                  )}
                </TableCell>
                <TableCell>{stage && <StageBadge stage={stage} />}</TableCell>
                <TableCell className="text-end tabular-nums">
                  {application.rating ?? "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
