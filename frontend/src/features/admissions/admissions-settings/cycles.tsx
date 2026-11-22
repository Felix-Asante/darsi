"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentSchool } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import {
  getAcademicYearsQueryOptions,
  getGradeLevelsQueryOptions,
} from "@/common/integrations/tanstack-query/query-options/academics";
import { getCyclesQueryOptions } from "@/common/integrations/tanstack-query/query-options/admissions";
import { getFeeItemsQueryOptions } from "@/common/integrations/tanstack-query/query-options/billing";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { formatCalendarDate, formatMoney } from "@/common/lib/format";
import { minorToInput, parseMoneyInput } from "@/common/lib/money-input";
import { api } from "@/common/service/api";
import type { Cycle } from "@/common/types/admissions";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Choice } from "./choice";
import { Section } from "./section";

const NONE = "none";

/** When families can apply, for which grades and how many places, and what it costs (ADMS-1, ADMS-10, ADMS-12). */
export function Cycles() {
  const t = useTranslations("admissions.cycles");
  const locale = useLocale();
  const school = useCurrentSchool();
  const queryClient = useQueryClient();
  const errorMessage = useApiErrorMessage();
  const cycles = useQuery(getCyclesQueryOptions());
  const years = useQuery(getAcademicYearsQueryOptions());
  const grades = useQuery(getGradeLevelsQueryOptions());
  const feeItems = useQuery(getFeeItemsQueryOptions());
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [yearId, setYearId] = useState("");
  const [opensOn, setOpensOn] = useState("");
  const [closesOn, setClosesOn] = useState("");
  const [places, setPlaces] = useState<Record<string, string>>({});
  const [fee, setFee] = useState("0");
  const [depositId, setDepositId] = useState(NONE);
  const [invalid, setInvalid] = useState(false);

  const edit = (cycle: Cycle) => {
    setEditing(cycle.id);
    setName(cycle.name);
    setYearId(cycle.academicYearId);
    setOpensOn(cycle.opensOn);
    setClosesOn(cycle.closesOn);
    setPlaces(
      Object.fromEntries(
        cycle.grades.map((grade) => [grade.gradeLevelId, String(grade.places)]),
      ),
    );
    setFee(minorToInput(cycle.applicationFee, school.currency));
    setDepositId(cycle.depositFeeItemId ?? NONE);
  };
  const reset = () => {
    setEditing(null);
    setName("");
    setPlaces({});
    setFee("0");
    setDepositId(NONE);
  };
  const gradeName = (id: string) =>
    grades.data?.find((grade) => grade.value === id)?.label ?? "";

  const save = useMutation({
    mutationFn: async () => {
      const applicationFee = parseMoneyInput(fee || "0", school.currency);
      const gradeList = Object.entries(places)
        .filter(([, value]) => value.trim())
        .map(([gradeLevelId, value]) => ({
          gradeLevelId,
          places: Number.parseInt(value, 10),
        }));
      if (
        !name.trim() ||
        !yearId ||
        !opensOn ||
        !closesOn ||
        applicationFee === null ||
        gradeList.length === 0 ||
        gradeList.some((grade) => !(grade.places >= 0))
      ) {
        setInvalid(true);
        return null;
      }
      setInvalid(false);
      return api.admissions.saveCycle(
        {
          name: name.trim(),
          academicYearId: yearId,
          opensOn,
          closesOn,
          grades: gradeList,
          applicationFee,
          depositFeeItemId: depositId === NONE ? null : depositId,
        },
        editing ?? undefined,
      );
    },
    onSuccess: async (response) => {
      if (!response) return;
      toast.success(t("saved"));
      reset();
      await queryClient.invalidateQueries({
        queryKey: queryKeys.admissions.all(),
      });
    },
  });

  return (
    <Section id="cycles" title={t("title")} description={t("description")}>
      {(cycles.data ?? []).length > 0 && (
        <ul className="bg-card divide-y rounded-lg border">
          {cycles.data?.map((cycle) => (
            <li
              key={cycle.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{cycle.name}</span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {formatCalendarDate(cycle.opensOn, locale)} –{" "}
                  {formatCalendarDate(cycle.closesOn, locale)} ·{" "}
                  {cycle.grades
                    .map(
                      (grade) =>
                        `${gradeName(grade.gradeLevelId)} (${grade.places})`,
                    )
                    .join(", ")}
                </span>
              </div>
              {cycle.applicationFee !== "0" && (
                <span className="text-sm tabular-nums">
                  {formatMoney(cycle.applicationFee, school.currency, locale)}
                </span>
              )}
              <Button variant="ghost" size="sm" onClick={() => edit(cycle)}>
                {t("edit")}
                <span className="sr-only"> {cycle.name}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="bg-card flex flex-col gap-4 rounded-lg border p-4"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <h3 className="font-medium">
          {editing ? t("editTitle") : t("newTitle")}
        </h3>
        <FormAlert
          message={
            invalid
              ? t("invalid")
              : save.error
                ? errorMessage(save.error)
                : null
          }
        />
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex w-full flex-col gap-1.5 sm:w-56">
            <Label htmlFor="cycle-name">{t("name")}</Label>
            <Input
              id="cycle-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <Choice
            id="cycle-year"
            label={t("year")}
            value={yearId}
            onChange={setYearId}
            items={(years.data ?? []).map((year) => ({
              value: year.id,
              label: year.name,
            }))}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cycle-opens">{t("opensOn")}</Label>
            <Input
              id="cycle-opens"
              type="date"
              className="w-44"
              value={opensOn}
              onChange={(event) => setOpensOn(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cycle-closes">{t("closesOn")}</Label>
            <Input
              id="cycle-closes"
              type="date"
              className="w-44"
              value={closesOn}
              onChange={(event) => setClosesOn(event.target.value)}
            />
          </div>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{t("places")}</legend>
          <p className="text-muted-foreground text-xs">{t("placesHint")}</p>
          <div className="flex flex-wrap gap-4">
            {(grades.data ?? []).map((grade) => (
              <div key={grade.value} className="flex w-32 flex-col gap-1.5">
                <Label htmlFor={`cycle-grade-${grade.value}`}>
                  {grade.label}
                </Label>
                <Input
                  id={`cycle-grade-${grade.value}`}
                  inputMode="numeric"
                  className="tabular-nums"
                  value={places[grade.value] ?? ""}
                  onChange={(event) =>
                    setPlaces((current) => ({
                      ...current,
                      [grade.value]: event.target.value,
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex w-40 flex-col gap-1.5">
            <Label htmlFor="cycle-fee">
              {t("applicationFee", { currency: school.currency })}
            </Label>
            <Input
              id="cycle-fee"
              inputMode="decimal"
              className="tabular-nums"
              value={fee}
              onChange={(event) => setFee(event.target.value)}
            />
          </div>
          <Choice
            id="cycle-deposit"
            label={t("deposit")}
            className="sm:w-64"
            value={depositId}
            onChange={setDepositId}
            items={[
              { value: NONE, label: t("noDeposit") },
              ...(feeItems.data ?? []).map((item) => ({
                value: item.id,
                label: item.name,
              })),
            ]}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={save.isPending}>
            {t("save")}
          </Button>
          {editing && (
            <Button type="button" variant="ghost" onClick={reset}>
              {t("cancel")}
            </Button>
          )}
        </div>
      </form>
    </Section>
  );
}
