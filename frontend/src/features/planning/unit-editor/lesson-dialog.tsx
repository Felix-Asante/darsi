"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import type { LessonInput, LessonPlan } from "@/common/types/daily";
import { FormAlert } from "@/components/form/form-alert";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LessonDialogProps {
  lesson?: LessonPlan;
  trigger: React.ReactElement;
  onSave: (input: LessonInput) => Promise<unknown>;
}

export function LessonDialog({ lesson, trigger, onSave }: Readonly<LessonDialogProps>) {
  const t = useTranslations("planning.unit");
  const tCommon = useTranslations("common");
  const errorMessage = useApiErrorMessage();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [date, setDate] = useState(lesson?.date ?? "");
  const [objectives, setObjectives] = useState(lesson?.objectives ?? null);
  const [activities, setActivities] = useState(lesson?.activities ?? null);
  const [resources, setResources] = useState(lesson?.resources ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const prefix = lesson?.id ?? "new";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ title: title.trim(), date: date || null, objectives, activities, resources });
      toast.success(t("lessonSaved"));
      setOpen(false);
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{lesson ? lesson.title : t("addLesson")}</DialogTitle>
          </DialogHeader>
          <FormAlert message={error} />
          <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${prefix}-title`}>{t("lessonTitle")}</Label>
              <Input id={`${prefix}-title`} value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${prefix}-date`}>{t("lessonDate")}</Label>
              <Input id={`${prefix}-date`} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </div>
          </div>
          {(
            [
              ["objectives", objectives, setObjectives],
              ["activities", activities, setActivities],
              ["resources", resources, setResources],
            ] as const
          ).map(([field, value, setValue]) => (
            <div key={field} className="flex flex-col gap-1.5">
              <Label htmlFor={`${prefix}-${field}`}>{t(field)}</Label>
              <RichTextEditor id={`${prefix}-${field}`} label={t(field)} value={value} onChange={setValue} minHeight="sm" />
            </div>
          ))}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={saving || !title.trim()}>
              {t("saveLesson")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
