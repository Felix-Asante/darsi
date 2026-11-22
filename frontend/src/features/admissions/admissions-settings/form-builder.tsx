"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { getDivisionsQueryOptions } from "@/common/integrations/tanstack-query/query-options/academics";
import { getAdmissionFormsQueryOptions } from "@/common/integrations/tanstack-query/query-options/admissions";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { api } from "@/common/service/api";
import type { AdmissionForm, FieldType } from "@/common/types/admissions";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Choice } from "./choice";
import { Section } from "./section";

const SCHOOL = "school";
const TYPES: FieldType[] = ["text", "textarea", "date", "select", "checkbox"];

interface Draft {
  id: string;
  key: string;
  en: string;
  fr: string;
  required: boolean;
  type: FieldType;
  options: string;
}

/** Turns a label into a stable key; keys already saved never change. */
const keyFrom = (label: string, taken: Set<string>) => {
  const base =
    label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/^(\d)/, "q_$1")
      .slice(0, 36) || "question";
  let key = base;
  for (let n = 2; taken.has(key); n += 1) key = `${base}_${n}`;
  return key;
};

const toDrafts = (
  form: Pick<AdmissionForm, "fields" | "documents"> | undefined,
) => ({
  fields: (form?.fields ?? []).map((field) => ({
    id: crypto.randomUUID(),
    key: field.key,
    en: field.label.en,
    fr: field.label.fr ?? "",
    required: field.required,
    type: field.type,
    options: (field.options ?? []).join(", "),
  })),
  documents: (form?.documents ?? []).map((document) => ({
    id: crypto.randomUUID(),
    key: document.key,
    en: document.label.en,
    fr: document.label.fr ?? "",
    required: document.required,
    type: "text" as FieldType,
    options: "",
  })),
});

/** The questions and documents each division asks for (ADMS-2). */
export function FormBuilder() {
  const t = useTranslations("admissions.formBuilder");
  const divisions = useQuery(getDivisionsQueryOptions());
  const forms = useQuery(getAdmissionFormsQueryOptions());
  const [scope, setScope] = useState(SCHOOL);
  const scopes = [
    { value: SCHOOL, label: t("wholeSchool") },
    ...(divisions.data ?? []).map((division) => ({
      value: division.id,
      label: division.name,
    })),
  ];
  const form = forms.data?.find(
    (entry) => (entry.divisionId ?? SCHOOL) === scope,
  );

  return (
    <Section
      id="form-builder"
      title={t("title")}
      description={t("description")}
    >
      <Choice
        id="form-scope"
        label={t("scope")}
        value={scope}
        onChange={setScope}
        items={scopes}
      />
      {forms.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <Editor
          key={`${scope}:${form?.id ?? "new"}`}
          scope={scope}
          initial={form}
        />
      )}
    </Section>
  );
}

function Editor({
  scope,
  initial,
}: Readonly<{ scope: string; initial: AdmissionForm | undefined }>) {
  const t = useTranslations("admissions.formBuilder");
  const queryClient = useQueryClient();
  const errorMessage = useApiErrorMessage();
  const [state, setState] = useState(() => toDrafts(initial));
  const [invalid, setInvalid] = useState(false);

  const update = (
    list: "fields" | "documents",
    id: string,
    patch: Partial<Draft>,
  ) =>
    setState((current) => ({
      ...current,
      [list]: current[list].map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    }));
  const remove = (list: "fields" | "documents", id: string) =>
    setState((current) => ({
      ...current,
      [list]: current[list].filter((entry) => entry.id !== id),
    }));
  const shift = (list: "fields" | "documents", index: number, by: number) =>
    setState((current) => {
      const next = [...current[list]];
      const [moved] = next.splice(index, 1);
      next.splice(index + by, 0, moved);
      return { ...current, [list]: next };
    });
  const add = (list: "fields" | "documents") =>
    setState((current) => ({
      ...current,
      [list]: [
        ...current[list],
        {
          id: crypto.randomUUID(),
          key: "",
          en: "",
          fr: "",
          required: true,
          type: "text",
          options: "",
        },
      ],
    }));

  const save = useMutation({
    mutationFn: async () => {
      const all = [...state.fields, ...state.documents];
      if (
        all.some((entry) => !entry.en.trim()) ||
        state.fields.some(
          (field) => field.type === "select" && !field.options.trim(),
        )
      ) {
        setInvalid(true);
        return null;
      }
      setInvalid(false);
      const taken = new Set(
        all.flatMap((entry) => (entry.key ? [entry.key] : [])),
      );
      const keyed = (entry: Draft) => {
        if (entry.key) return entry.key;
        const key = keyFrom(entry.en, taken);
        taken.add(key);
        return key;
      };
      const label = (entry: Draft) => ({
        en: entry.en.trim(),
        ...(entry.fr.trim() ? { fr: entry.fr.trim() } : {}),
      });
      return api.admissions.saveForm({
        divisionId: scope === SCHOOL ? null : scope,
        fields: state.fields.map((field) => ({
          key: keyed(field),
          label: label(field),
          type: field.type,
          required: field.required,
          ...(field.type === "select"
            ? {
                options: field.options
                  .split(",")
                  .map((option) => option.trim())
                  .filter(Boolean),
              }
            : {}),
        })),
        documents: state.documents.map((document) => ({
          key: keyed(document),
          label: label(document),
          required: document.required,
        })),
      });
    },
    onSuccess: async (response) => {
      if (!response) return;
      toast.success(t("saved"));
      await queryClient.invalidateQueries({
        queryKey: queryKeys.admissions.forms(),
      });
    },
  });

  const rows = (list: "fields" | "documents") =>
    state[list].map((entry, index) => (
      <li
        key={entry.id}
        className="bg-card flex flex-wrap items-end gap-3 rounded-lg border p-3"
      >
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <Label htmlFor={`${entry.id}-en`}>{t("labelEn")}</Label>
          <Input
            id={`${entry.id}-en`}
            value={entry.en}
            onChange={(event) =>
              update(list, entry.id, { en: event.target.value })
            }
          />
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <Label htmlFor={`${entry.id}-fr`}>{t("labelFr")}</Label>
          <Input
            id={`${entry.id}-fr`}
            lang="fr"
            value={entry.fr}
            onChange={(event) =>
              update(list, entry.id, { fr: event.target.value })
            }
          />
        </div>
        {list === "fields" && (
          <Choice
            id={`${entry.id}-type`}
            label={t("type")}
            className="sm:w-40"
            value={entry.type}
            onChange={(type) => update(list, entry.id, { type })}
            items={TYPES.map((type) => ({
              value: type,
              label: t(`types.${type}`),
            }))}
          />
        )}
        {list === "fields" && entry.type === "select" && (
          <div className="flex w-full flex-col gap-1.5">
            <Label htmlFor={`${entry.id}-options`}>{t("options")}</Label>
            <Input
              id={`${entry.id}-options`}
              value={entry.options}
              onChange={(event) =>
                update(list, entry.id, { options: event.target.value })
              }
            />
          </div>
        )}
        <div className="flex items-center gap-2 pb-2">
          <Checkbox
            id={`${entry.id}-required`}
            checked={entry.required}
            onCheckedChange={(checked) =>
              update(list, entry.id, { required: checked === true })
            }
          />
          <Label htmlFor={`${entry.id}-required`} className="font-normal">
            {t("required")}
          </Label>
        </div>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={index === 0}
            onClick={() => shift(list, index, -1)}
          >
            <ArrowUpIcon aria-hidden />
            <span className="sr-only">
              {t("moveUp", { label: entry.en || index + 1 })}
            </span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={index === state[list].length - 1}
            onClick={() => shift(list, index, 1)}
          >
            <ArrowDownIcon aria-hidden />
            <span className="sr-only">
              {t("moveDown", { label: entry.en || index + 1 })}
            </span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => remove(list, entry.id)}
          >
            <Trash2Icon aria-hidden />
            <span className="sr-only">
              {t("remove", { label: entry.en || index + 1 })}
            </span>
          </Button>
        </div>
      </li>
    ));

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <FormAlert
        message={
          invalid ? t("invalid") : save.error ? errorMessage(save.error) : null
        }
      />
      <p className="text-muted-foreground text-sm">{t("standard")}</p>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-medium">{t("questions")}</legend>
        <ul className="flex flex-col gap-2">{rows("fields")}</ul>
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => add("fields")}
        >
          <PlusIcon aria-hidden />
          {t("addQuestion")}
        </Button>
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-medium">{t("documents")}</legend>
        <ul className="flex flex-col gap-2">{rows("documents")}</ul>
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => add("documents")}
        >
          <PlusIcon aria-hidden />
          {t("addDocument")}
        </Button>
      </fieldset>
      <Button type="submit" className="self-start" disabled={save.isPending}>
        {t("save")}
      </Button>
    </form>
  );
}
