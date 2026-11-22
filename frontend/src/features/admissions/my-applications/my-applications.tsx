"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { Link, useRouter } from "@/common/i18n/navigation";
import {
  getMyApplicationsQueryOptions,
  getPublicAdmissionsQueryOptions,
} from "@/common/integrations/tanstack-query/query-options/admissions";
import { api } from "@/common/service/api";
import { FormAlert } from "@/components/form/form-alert";
import { Badge } from "@/components/ui/badge";
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
import { StageBadge } from "../_shared/stage-badge";

/** A family's applications, and a new one for any grade taking applications (ADMS-4). */
export function MyApplications() {
  const t = useTranslations("admissions.mine");
  const errorMessage = useApiErrorMessage();
  const applications = useQuery(getMyApplicationsQueryOptions());

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground max-w-prose text-sm">
          {t("description")}
        </p>
      </div>
      <FormAlert
        message={applications.error ? errorMessage(applications.error) : null}
      />
      {applications.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        applications.data &&
        applications.data.length > 0 && (
          <ul className="bg-card divide-y rounded-lg border">
            {applications.data.map((application) => (
              <li
                key={application.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
              >
                <Link
                  href={`/applications/${application.id}`}
                  className="min-w-0 flex-1 font-medium hover:underline"
                >
                  {[application.student.firstName, application.student.lastName]
                    .filter(Boolean)
                    .join(" ") || t("unnamed")}
                </Link>
                <span className="text-muted-foreground text-sm">
                  {application.gradeLevel.name} · {application.cycle.name}
                </span>
                {application.stage ? (
                  <StageBadge stage={application.stage} />
                ) : (
                  <Badge variant="info">{t("draft")}</Badge>
                )}
              </li>
            ))}
          </ul>
        )
      )}
      <NewApplication />
    </div>
  );
}

function NewApplication() {
  const t = useTranslations("admissions.mine");
  const router = useRouter();
  const errorMessage = useApiErrorMessage();
  const page = useQuery(getPublicAdmissionsQueryOptions());
  const [choice, setChoice] = useState("");
  const options = (page.data?.cycles ?? []).flatMap((cycle) =>
    cycle.grades.map((grade) => ({
      value: `${cycle.id}:${grade.id}`,
      label: `${grade.name} · ${cycle.name}`,
    })),
  );
  const create = useMutation({
    mutationFn: () => {
      const [cycleId, gradeLevelId] = choice.split(":");
      return api.admissions.createApplication({ cycleId, gradeLevelId });
    },
    onSuccess: (response) => router.push(`/applications/${response.data.id}`),
  });

  if (page.isSuccess && options.length === 0)
    return <p className="text-muted-foreground text-sm">{t("closed")}</p>;
  return (
    <form
      className="bg-card flex flex-col gap-4 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (choice) create.mutate();
      }}
    >
      <h2 className="font-medium">{t("new")}</h2>
      <FormAlert message={create.error ? errorMessage(create.error) : null} />
      <div className="flex w-full flex-col gap-1.5 sm:w-80">
        <Label htmlFor="new-application-grade">{t("grade")}</Label>
        <Select
          items={options}
          value={choice || null}
          onValueChange={(next) => next && setChoice(next)}
        >
          <SelectTrigger id="new-application-grade" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="submit"
        className="self-start"
        disabled={!choice || create.isPending}
      >
        {t("start")}
      </Button>
    </form>
  );
}
