"use client";

import { SchoolIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import type { SchoolMembership } from "@/common/types/identity";
import { FormAlert } from "@/components/form/form-alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { useSwitchSchool } from "../_shared/use-switch-school";

export function SchoolPicker({ schools }: Readonly<{ schools: SchoolMembership[] }>) {
  const t = useTranslations("schoolSwitcher");
  const errorMessage = useApiErrorMessage();
  const switchSchool = useSwitchSchool();

  if (schools.length === 0) {
    return (
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SchoolIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>{t("title")}</EmptyTitle>
          <EmptyDescription>{t("noSchools")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>
      <FormAlert message={switchSchool.error ? errorMessage(switchSchool.error) : null} />
      <ul className="bg-card divide-y rounded-lg border">
        {schools.map((school) => (
          <li key={school.id}>
            <button
              type="button"
              disabled={switchSchool.isPending}
              onClick={() => switchSchool.mutate(school)}
              className="hover:bg-accent focus-visible:ring-ring/50 flex w-full items-center gap-3 px-4 py-3 text-start outline-none focus-visible:ring-3 disabled:opacity-60"
            >
              <span aria-hidden className="bg-primary/10 text-primary grid size-8 place-items-center rounded-md text-sm font-semibold">
                {school.name.charAt(0)}
              </span>
              <span className="font-medium">{school.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
