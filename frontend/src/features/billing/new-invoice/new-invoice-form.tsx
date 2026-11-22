"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useCurrentSchool } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { useRouter } from "@/common/i18n/navigation";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { parseMoneyInput, parsePercentInput } from "@/common/lib/money-input";
import { api } from "@/common/service/api";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FamilySelect } from "../_shared/family-select";
import { PageHeader } from "../_shared/page-header";

interface LineDraft {
  key: string;
  description: string;
  quantity: string;
  unitAmount: string;
  taxRate: string;
}

const emptyLine = (): LineDraft => ({
  key: crypto.randomUUID(),
  description: "",
  quantity: "1",
  unitAmount: "",
  taxRate: "0",
});

/** A one-off invoice, saved as a draft to check before it is issued (FEE-6). */
export function NewInvoiceForm() {
  const t = useTranslations("billing.newInvoice");
  const school = useCurrentSchool();
  const router = useRouter();
  const queryClient = useQueryClient();
  const errorMessage = useApiErrorMessage();
  const [familyId, setFamilyId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [invalid, setInvalid] = useState(false);

  const update = (key: string, patch: Partial<LineDraft>) =>
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );

  const create = useMutation({
    mutationFn: async () => {
      const parsed = lines.map((line) => ({
        description: line.description.trim(),
        quantity: Number.parseInt(line.quantity, 10),
        unitAmount: parseMoneyInput(line.unitAmount, school.currency),
        taxRateBp: parsePercentInput(line.taxRate),
      }));
      if (
        !familyId ||
        parsed.some(
          (line) =>
            !line.description ||
            !(line.quantity > 0) ||
            line.unitAmount === null ||
            line.taxRateBp === null,
        )
      ) {
        setInvalid(true);
        return null;
      }
      setInvalid(false);
      return api.billing.createDraft({
        familyId,
        notes: notes.trim() || null,
        lines: parsed.map((line) => ({
          ...line,
          unitAmount: line.unitAmount!,
          taxRateBp: line.taxRateBp!,
        })),
      });
    },
    onSuccess: async (response) => {
      if (!response) return;
      await queryClient.invalidateQueries({
        queryKey: queryKeys.billing.all(),
      });
      router.push(`/billing/invoices/${response.data.id}`);
    },
  });

  return (
    <form
      className="flex max-w-4xl flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      <PageHeader title={t("title")} description={t("description")} />
      <FormAlert
        message={
          invalid
            ? t("invalid")
            : create.error
              ? errorMessage(create.error)
              : null
        }
      />
      <FamilySelect
        id="invoice-family"
        value={familyId}
        onChange={setFamilyId}
      />
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-medium">{t("lines")}</legend>
        {lines.map((line, index) => (
          <div
            key={line.key}
            className="bg-card flex flex-wrap items-end gap-3 rounded-lg border p-3"
          >
            <div className="flex min-w-48 flex-1 flex-col gap-1.5">
              <Label htmlFor={`line-${line.key}-description`}>
                {t("lineDescription")}
              </Label>
              <Input
                id={`line-${line.key}-description`}
                value={line.description}
                onChange={(event) =>
                  update(line.key, { description: event.target.value })
                }
              />
            </div>
            <div className="flex w-20 flex-col gap-1.5">
              <Label htmlFor={`line-${line.key}-quantity`}>
                {t("quantity")}
              </Label>
              <Input
                id={`line-${line.key}-quantity`}
                inputMode="numeric"
                className="tabular-nums"
                value={line.quantity}
                onChange={(event) =>
                  update(line.key, { quantity: event.target.value })
                }
              />
            </div>
            <div className="flex w-36 flex-col gap-1.5">
              <Label htmlFor={`line-${line.key}-amount`}>
                {t("unitAmount", { currency: school.currency })}
              </Label>
              <Input
                id={`line-${line.key}-amount`}
                inputMode="decimal"
                className="tabular-nums"
                value={line.unitAmount}
                onChange={(event) =>
                  update(line.key, { unitAmount: event.target.value })
                }
              />
            </div>
            <div className="flex w-24 flex-col gap-1.5">
              <Label htmlFor={`line-${line.key}-tax`}>{t("taxRate")}</Label>
              <Input
                id={`line-${line.key}-tax`}
                inputMode="decimal"
                className="tabular-nums"
                value={line.taxRate}
                onChange={(event) =>
                  update(line.key, { taxRate: event.target.value })
                }
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={lines.length === 1}
              onClick={() =>
                setLines((current) =>
                  current.filter((entry) => entry.key !== line.key),
                )
              }
            >
              <Trash2Icon aria-hidden />
              <span className="sr-only">
                {t("removeLine", { number: index + 1 })}
              </span>
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => setLines((current) => [...current, emptyLine()])}
        >
          <PlusIcon aria-hidden />
          {t("addLine")}
        </Button>
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invoice-notes">{t("notes")}</Label>
        <Textarea
          id="invoice-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>
      <Button type="submit" className="self-start" disabled={create.isPending}>
        {t("save")}
      </Button>
    </form>
  );
}
