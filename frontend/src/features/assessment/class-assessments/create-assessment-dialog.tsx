"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import type { AssessmentInput, AssessmentKind, GradingScale } from "@/common/types/assessment";
import { getFieldErrors } from "@/common/utils/errors";
import { FormAlert } from "@/components/form/form-alert";
import { useValidationMessage } from "@/components/form/use-validation-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StandardsPicker } from "./standards-picker";

interface CreateAssessmentDialogProps {
  scales: GradingScale[];
  categories: { id: string; name: string }[];
  onCreate: (input: AssessmentInput) => Promise<unknown>;
}

function Choice({
  id,
  label,
  items,
  value,
  onChange,
}: Readonly<{ id: string; label: string; items: { value: string; label: string }[]; value: string; onChange: (value: string) => void }>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select items={items} value={value} onValueChange={(next) => onChange(next ?? "")}>
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

export function CreateAssessmentDialog({ scales, categories, onCreate }: Readonly<CreateAssessmentDialogProps>) {
  const t = useTranslations("assessment");
  const tCommon = useTranslations("common");
  const errorMessage = useApiErrorMessage();
  const validationMessage = useValidationMessage();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<AssessmentKind>("summative");
  const [dueOn, setDueOn] = useState("");
  const [scaleId, setScaleId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [criteria, setCriteria] = useState<{ name: string; scaleId: string }[]>([]);
  const [standardIds, setStandardIds] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const scaleItems = scales.map((scale) => ({ value: scale.id, label: scale.name }));

  const reset = () => {
    setTitle("");
    setDescription("");
    setKind("summative");
    setDueOn("");
    setScaleId(scales[0]?.id ?? "");
    setCategoryId("");
    setCriteria([]);
    setStandardIds([]);
    setFieldErrors({});
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const missing: Record<string, string> = {};
    if (!title.trim()) missing.title = validationMessage("required")!;
    if (!scaleId) missing.scaleId = validationMessage("required")!;
    setFieldErrors(missing);
    if (Object.keys(missing).length > 0) return;
    setSaving(true);
    setError(null);
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim() || null,
        kind,
        dueOn: dueOn || null,
        scaleId,
        categoryId: categoryId || null,
        criteria: criteria.filter((criterion) => criterion.name.trim() && criterion.scaleId),
        standardIds,
      });
      toast.success(t("form.created", { title }));
      setOpen(false);
    } catch (saveError) {
      const fields = getFieldErrors(saveError);
      setFieldErrors(Object.fromEntries(Object.entries(fields).map(([field, codes]) => [field, validationMessage(codes[0]) ?? ""])));
      if (Object.keys(fields).length === 0) setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <PlusIcon aria-hidden />
        {t("list.create")}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{t("form.title")}</DialogTitle>
            <DialogDescription>{t("form.description")}</DialogDescription>
          </DialogHeader>
          <FormAlert message={error} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assessment-title">{t("form.name")}</Label>
            <Input
              id="assessment-title"
              value={title}
              aria-invalid={Boolean(fieldErrors.title)}
              aria-describedby={fieldErrors.title ? "assessment-title-error" : undefined}
              onChange={(event) => setTitle(event.target.value)}
            />
            {fieldErrors.title && (
              <p id="assessment-title-error" className="text-destructive text-sm">
                {fieldErrors.title}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assessment-details">{`${t("form.details")} (${tCommon("optional")})`}</Label>
            <Textarea id="assessment-details" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Choice
              id="assessment-kind"
              label={t("form.kind")}
              value={kind}
              onChange={(value) => setKind(value as AssessmentKind)}
              items={[
                { value: "summative", label: t("list.kinds.summative") },
                { value: "formative", label: t("list.kinds.formative") },
              ]}
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assessment-due">{`${t("form.dueOn")} (${tCommon("optional")})`}</Label>
              <Input id="assessment-due" type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Choice id="assessment-scale" label={t("form.scale")} value={scaleId} onChange={setScaleId} items={scaleItems} />
              {fieldErrors.scaleId && <p className="text-destructive text-sm">{fieldErrors.scaleId}</p>}
            </div>
            <Choice
              id="assessment-category"
              label={t("form.category")}
              value={categoryId}
              onChange={setCategoryId}
              items={[{ value: "", label: t("form.noCategory") }, ...categories.map((category) => ({ value: category.id, label: category.name }))]}
            />
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t("form.criteria")}</legend>
            <p className="text-muted-foreground text-sm">{t("form.criteriaHint")}</p>
            {criteria.map((criterion, index) => (
              <div key={index} className="grid grid-cols-[1fr_10rem_2rem] items-center gap-2">
                <Input
                  aria-label={`${t("form.criterionName")} ${index + 1}`}
                  value={criterion.name}
                  onChange={(event) =>
                    setCriteria((current) => current.map((entry, position) => (position === index ? { ...entry, name: event.target.value } : entry)))
                  }
                />
                <Select
                  items={scaleItems}
                  value={criterion.scaleId}
                  onValueChange={(value) =>
                    setCriteria((current) => current.map((entry, position) => (position === index ? { ...entry, scaleId: value ?? "" } : entry)))
                  }
                >
                  <SelectTrigger aria-label={`${t("form.criterionScale")} ${index + 1}`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {scaleItems.map((item) => (
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
                  aria-label={t("form.removeCriterion", { name: criterion.name || String(index + 1) })}
                  onClick={() => setCriteria((current) => current.filter((_, position) => position !== index))}
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
              onClick={() => setCriteria((current) => [...current, { name: "", scaleId }])}
            >
              <PlusIcon aria-hidden />
              {t("form.addCriterion")}
            </Button>
          </fieldset>

          <StandardsPicker value={standardIds} onChange={setStandardIds} />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {t("form.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
