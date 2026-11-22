"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentSchool } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import {
  getCurrentYearQueryOptions,
  getGradeLevelsQueryOptions,
} from "@/common/integrations/tanstack-query/query-options/academics";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import {
  getFeeItemsQueryOptions,
  getFeeStructuresQueryOptions,
} from "@/common/integrations/tanstack-query/query-options/billing";
import { minorToInput, parseMoneyInput } from "@/common/lib/money-input";
import { api } from "@/common/service/api";
import type { FeeStructure } from "@/common/types/billing";
import { FormAlert } from "@/components/form/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Choice } from "../_shared/choice";
import { useMoney } from "../_shared/use-money";
import { Section } from "./section";

const ALL_GRADES = "all";

/** What each grade pays this year and how often (FEE-3). One structure per grade, or one for the whole school. */
export function FeeStructures() {
  const t = useTranslations("billing.structures");
  const tBilling = useTranslations("billing");
  const school = useCurrentSchool();
  const money = useMoney();
  const queryClient = useQueryClient();
  const errorMessage = useApiErrorMessage();
  const year = useQuery(getCurrentYearQueryOptions());
  const grades = useQuery(getGradeLevelsQueryOptions());
  const items = useQuery(getFeeItemsQueryOptions());
  const structures = useQuery(
    getFeeStructuresQueryOptions(year.data?.id ?? ""),
  );
  const [gradeLevelId, setGradeLevelId] = useState(ALL_GRADES);
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState<FeeStructure["schedule"]>("term");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [invalid, setInvalid] = useState(false);
  const activeItems = (items.data ?? []).filter((item) => item.active);
  const gradeName = (id: string | null) =>
    id
      ? (grades.data?.find((grade) => grade.value === id)?.label ?? "")
      : t("allGrades");

  const edit = (structure: FeeStructure) => {
    setGradeLevelId(structure.gradeLevelId ?? ALL_GRADES);
    setName(structure.name);
    setSchedule(structure.schedule);
    setAmounts(
      Object.fromEntries(
        structure.lines.map((line) => [
          line.feeItemId,
          minorToInput(line.amount, school.currency),
        ]),
      ),
    );
  };

  const save = useMutation({
    mutationFn: async () => {
      const lines = Object.entries(amounts)
        .filter(([, value]) => value.trim())
        .map(([feeItemId, value]) => ({
          feeItemId,
          amount: parseMoneyInput(value, school.currency),
        }));
      if (
        !year.data ||
        !name.trim() ||
        lines.length === 0 ||
        lines.some((line) => line.amount === null)
      ) {
        setInvalid(true);
        return null;
      }
      setInvalid(false);
      return api.billing.saveStructure({
        academicYearId: year.data.id,
        gradeLevelId: gradeLevelId === ALL_GRADES ? null : gradeLevelId,
        name: name.trim(),
        schedule,
        lines: lines.map((line) => ({
          feeItemId: line.feeItemId,
          amount: line.amount!,
        })),
      });
    },
    onSuccess: async (response) => {
      if (!response) return;
      toast.success(t("saved"));
      setName("");
      setAmounts({});
      await queryClient.invalidateQueries({
        queryKey: queryKeys.billing.all(),
      });
    },
  });

  if (year.isSuccess && !year.data) {
    return (
      <Section
        id="fee-structures"
        title={t("title")}
        description={t("description", { year: "" })}
      >
        <p className="text-muted-foreground text-sm">{t("noYear")}</p>
      </Section>
    );
  }

  return (
    <Section
      id="fee-structures"
      title={t("title")}
      description={t("description", { year: year.data?.name ?? "" })}
    >
      {(structures.data ?? []).length > 0 && (
        <ul className="bg-card divide-y rounded-lg border">
          {structures.data?.map((structure) => (
            <li key={structure.id} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="min-w-0 flex-1 font-medium">
                  {structure.name} · {gradeName(structure.gradeLevelId)}
                </span>
                <Badge variant="outline">
                  {tBilling(`schedules.${structure.schedule}`)}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => edit(structure)}
                >
                  {t("edit")}
                  <span className="sr-only"> {structure.name}</span>
                </Button>
              </div>
              <ul className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-sm">
                {structure.lines.map((line) => (
                  <li key={line.feeItemId}>
                    {
                      items.data?.find((item) => item.id === line.feeItemId)
                        ?.name
                    }
                    : <span className="tabular-nums">{money(line.amount)}</span>
                  </li>
                ))}
              </ul>
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
          <Choice
            id="structure-grade"
            label={t("grade")}
            value={gradeLevelId}
            onChange={setGradeLevelId}
            items={[
              { value: ALL_GRADES, label: t("allGrades") },
              ...(grades.data ?? []).map((grade) => ({
                value: grade.value,
                label: grade.label,
              })),
            ]}
          />
          <div className="flex w-full flex-col gap-1.5 sm:w-56">
            <Label htmlFor="structure-name">{t("name")}</Label>
            <Input
              id="structure-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <Choice
            id="structure-schedule"
            label={t("schedule")}
            className="sm:w-44"
            value={schedule}
            onChange={setSchedule}
            items={(["term", "monthly", "annual"] as const).map((value) => ({
              value,
              label: tBilling(`schedules.${value}`),
            }))}
          />
        </div>
        {activeItems.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noItems")}</p>
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">
              {t("amounts", { currency: school.currency })}
            </legend>
            <p className="text-muted-foreground text-xs">{t("amountsHint")}</p>
            <div className="flex flex-wrap gap-4">
              {activeItems.map((item) => (
                <div key={item.id} className="flex w-40 flex-col gap-1.5">
                  <Label htmlFor={`structure-${item.id}`}>{item.name}</Label>
                  <Input
                    id={`structure-${item.id}`}
                    inputMode="decimal"
                    className="tabular-nums"
                    placeholder={minorToInput(item.amount, school.currency)}
                    value={amounts[item.id] ?? ""}
                    onChange={(event) =>
                      setAmounts((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </fieldset>
        )}
        <Button
          type="submit"
          className="self-start"
          disabled={save.isPending || activeItems.length === 0}
        >
          {t("save")}
        </Button>
      </form>
    </Section>
  );
}
