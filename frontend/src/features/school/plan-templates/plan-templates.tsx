"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { getPlanTemplatesQueryOptions } from "@/common/integrations/tanstack-query/query-options/planning";
import { api } from "@/common/service/api";
import type { PlanTemplate, TemplateField } from "@/common/types/daily";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

/** Field keys come from labels, so admins never type them. */
const keyFor = (label: string, taken: string[]) => {
  const base =
    label
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/^(\d)/, "f_$1")
      .slice(0, 30) || "field";
  let key = base;
  for (let index = 2; taken.includes(key); index += 1) key = `${base}_${index}`;
  return key;
};

function TemplateEditor({ template }: Readonly<{ template?: PlanTemplate }>) {
  const t = useTranslations("planning.templates");
  const errorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const [name, setName] = useState(template?.name ?? "");
  const [fields, setFields] = useState<TemplateField[]>(template?.fields ?? []);
  const kindItems = (["text", "richtext"] as const).map((value) => ({ value, label: t(`kinds.${value}`) }));
  const prefix = template?.id ?? "new";
  const save = useMutation({
    mutationFn: () => {
      const keys: string[] = [];
      const withKeys = fields
        .filter((field) => field.label.trim())
        .map((field) => {
          const key = field.key || keyFor(field.label, keys);
          keys.push(key);
          return { ...field, key, label: field.label.trim() };
        });
      return api.planning.saveTemplate({ name: name.trim(), fields: withKeys }, template?.id);
    },
    onSuccess: async () => {
      toast.success(t("saved"));
      if (!template) {
        setName("");
        setFields([]);
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.planning.templates() });
    },
  });

  return (
    <form
      className="bg-card flex flex-col gap-3 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) save.mutate();
      }}
    >
      <FormAlert message={save.error ? errorMessage(save.error) : null} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${prefix}-name`}>{t("name")}</Label>
        <Input id={`${prefix}-name`} value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t("fields")}</legend>
        {fields.map((field, index) => (
          <div key={index} className="grid grid-cols-[1fr_11rem_2rem] items-center gap-2">
            <Input
              aria-label={`${t("fieldLabel")} ${index + 1}`}
              value={field.label}
              onChange={(event) =>
                setFields((current) => current.map((entry, position) => (position === index ? { ...entry, label: event.target.value } : entry)))
              }
            />
            <Select
              items={kindItems}
              value={field.kind}
              onValueChange={(value) =>
                value &&
                setFields((current) =>
                  current.map((entry, position) => (position === index ? { ...entry, kind: value as TemplateField["kind"] } : entry)),
                )
              }
            >
              <SelectTrigger aria-label={`${t("fieldKind")} ${index + 1}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {kindItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("removeField", { label: field.label || String(index + 1) })}
              onClick={() => setFields((current) => current.filter((_, position) => position !== index))}
            >
              <Trash2Icon aria-hidden />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setFields((current) => [...current, { key: "", label: "", kind: "text" }])}
        >
          <PlusIcon aria-hidden />
          {t("addField")}
        </Button>
      </fieldset>
      <Button type="submit" className="self-start" disabled={save.isPending || !name.trim()}>
        {template ? t("save") : t("add")}
      </Button>
    </form>
  );
}

export function PlanTemplates() {
  const t = useTranslations("planning.templates");
  const templates = useQuery(getPlanTemplatesQueryOptions());
  return (
    <section aria-labelledby="templates-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="templates-title" className="text-lg font-semibold tracking-tight">
          {t("title")}
        </h2>
        <p className="text-muted-foreground max-w-prose text-sm">{t("description")}</p>
      </div>
      {templates.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <>
          {templates.data?.length === 0 && <p className="text-muted-foreground text-sm">{t("empty")}</p>}
          {(templates.data ?? []).map((template) => (
            <TemplateEditor key={`${template.id}-${template.name}`} template={template} />
          ))}
          <TemplateEditor />
        </>
      )}
    </section>
  );
}
