"use client";

import { useQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { getClassesQueryOptions } from "@/common/integrations/tanstack-query/query-options/academics";
import { getPlanTemplatesQueryOptions } from "@/common/integrations/tanstack-query/query-options/planning";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import type { UnitInput } from "@/common/types/daily";
import { FormAlert } from "@/components/form/form-alert";
import { useValidationMessage } from "@/components/form/use-validation-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CreateUnitDialog({ onCreate }: Readonly<{ onCreate: (input: UnitInput) => Promise<unknown> }>) {
  const t = useTranslations("planning");
  const tCommon = useTranslations("common");
  const errorMessage = useApiErrorMessage();
  const validationMessage = useValidationMessage();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const templates = useQuery({ ...getPlanTemplatesQueryOptions(), enabled: open });
  const classes = useQuery({ ...getClassesQueryOptions({ mine: true }), enabled: open });
  const templateItems = [
    { value: "", label: t("unitForm.noTemplate") },
    ...(templates.data ?? []).map((template) => ({ value: template.id, label: template.name })),
  ];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || classIds.length === 0) {
      setMissing(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onCreate({
        title: title.trim(),
        templateId: templateId || null,
        classIds,
        startsOn: startsOn || null,
        endsOn: endsOn || null,
      });
      setOpen(false);
    } catch (createError) {
      setError(errorMessage(createError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setTitle("");
          setTemplateId("");
          setClassIds([]);
          setStartsOn("");
          setEndsOn("");
          setError(null);
          setMissing(false);
        }
      }}
    >
      <DialogTrigger render={<Button />}>
        <PlusIcon aria-hidden />
        {t("newUnit")}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{t("unitForm.title")}</DialogTitle>
          </DialogHeader>
          <FormAlert message={error} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="unit-title">{t("unitForm.name")}</Label>
            <Input id="unit-title" value={title} aria-invalid={missing && !title.trim()} onChange={(event) => setTitle(event.target.value)} />
            {missing && !title.trim() && <p className="text-destructive text-sm">{validationMessage("required")}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="unit-template">{t("unitForm.template")}</Label>
            <Select items={templateItems} value={templateId} onValueChange={(value) => setTemplateId(value ?? "")}>
              <SelectTrigger id="unit-template" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {templateItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t("unitForm.classes")}</legend>
            {(classes.data ?? []).map((schoolClass) => (
              <label key={schoolClass.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={classIds.includes(schoolClass.id)}
                  onCheckedChange={(checked) =>
                    setClassIds((current) =>
                      checked === true ? [...current, schoolClass.id] : current.filter((id) => id !== schoolClass.id),
                    )
                  }
                />
                {schoolClass.name}
              </label>
            ))}
            {missing && classIds.length === 0 && <p className="text-destructive text-sm">{validationMessage("required")}</p>}
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unit-start">{`${t("unitForm.startsOn")} (${tCommon("optional")})`}</Label>
              <Input id="unit-start" type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unit-end">{`${t("unitForm.endsOn")} (${tCommon("optional")})`}</Label>
              <Input id="unit-end" type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {t("unitForm.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
