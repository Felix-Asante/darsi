"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { useDebouncedValue } from "@/common/hooks/use-debounced-value";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { getDiscountsQueryOptions } from "@/common/integrations/tanstack-query/query-options/billing";
import { getStudentSearchQueryOptions } from "@/common/integrations/tanstack-query/query-options/people";
import { api } from "@/common/service/api";
import type { StudentSummary } from "@/common/types/people";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Section } from "./section";

const fullName = (student: StudentSummary) =>
  `${student.preferredName ?? student.firstName} ${student.lastName}`;

/** Which discounts each student receives on future invoices (FEE-4). */
export function StudentDiscounts() {
  const t = useTranslations("billing.studentDiscounts");
  const queryClient = useQueryClient();
  const errorMessage = useApiErrorMessage();
  const discounts = useQuery(getDiscountsQueryOptions());
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim(), 250);
  const students = useQuery(
    getStudentSearchQueryOptions(debounced, debounced.length >= 2),
  );
  const [student, setStudent] = useState<StudentSummary | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const choose = (next: StudentSummary) => {
    setStudent(next);
    setSelected(
      (discounts.data ?? [])
        .filter((discount) => discount.studentIds.includes(next.id))
        .map((discount) => discount.id),
    );
  };
  const save = useMutation({
    mutationFn: () => api.billing.setStudentDiscounts(student!.id, selected),
    onSuccess: async () => {
      toast.success(t("saved", { student: fullName(student!) }));
      await queryClient.invalidateQueries({
        queryKey: queryKeys.billing.all(),
      });
    },
  });

  if ((discounts.data ?? []).length === 0) return null;
  return (
    <Section
      id="student-discounts"
      title={t("title")}
      description={t("description")}
    >
      <div className="bg-card flex flex-col gap-4 rounded-lg border p-4">
        <div className="flex w-full flex-col gap-1.5 sm:w-72">
          <Label htmlFor="discount-student-search">{t("search")}</Label>
          <Input
            id="discount-student-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {debounced.length >= 2 && !student && (
          <ul className="divide-y rounded-md border" aria-label={t("results")}>
            {(students.data ?? []).map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className="hover:bg-muted flex w-full gap-3 px-3 py-2 text-start text-sm"
                  onClick={() => choose(entry)}
                >
                  <span className="flex-1">{fullName(entry)}</span>
                  <code className="text-muted-foreground text-xs">
                    {entry.studentNumber}
                  </code>
                </button>
              </li>
            ))}
            {students.data?.length === 0 && (
              <li className="text-muted-foreground px-3 py-2 text-sm">
                {t("noResults")}
              </li>
            )}
          </ul>
        )}
        {student && (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <FormAlert message={save.error ? errorMessage(save.error) : null} />
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 font-medium">
                {t("for", { student: fullName(student) })}
              </legend>
              {discounts.data?.map((discount) => (
                <div key={discount.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`student-discount-${discount.id}`}
                    checked={selected.includes(discount.id)}
                    onCheckedChange={(checked) =>
                      setSelected((current) =>
                        checked === true
                          ? [...current, discount.id]
                          : current.filter((id) => id !== discount.id),
                      )
                    }
                  />
                  <Label
                    htmlFor={`student-discount-${discount.id}`}
                    className="font-normal"
                  >
                    {discount.name}
                  </Label>
                </div>
              ))}
            </fieldset>
            <div className="flex gap-2">
              <Button type="submit" disabled={save.isPending}>
                {t("save")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStudent(null)}
              >
                {t("change")}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Section>
  );
}
