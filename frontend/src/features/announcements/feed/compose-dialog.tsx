"use client";

import { useQuery } from "@tanstack/react-query";
import { PenSquareIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentSchool, useHasRole } from "@/common/auth/me-context";
import { ROLES } from "@/common/auth/roles";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import {
  getClassesQueryOptions,
  getDivisionsQueryOptions,
  getGradeLevelsQueryOptions,
} from "@/common/integrations/tanstack-query/query-options/academics";
import type { AnnouncementAudience, AnnouncementInput } from "@/common/types/daily";
import { isEmptyRichText, type RichTextNode } from "@/common/types/rich-text";
import { getFieldErrors } from "@/common/utils/errors";
import { FormAlert } from "@/components/form/form-alert";
import { useValidationMessage } from "@/components/form/use-validation-message";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
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

export function ComposeDialog({ onSend }: Readonly<{ onSend: (input: AnnouncementInput) => Promise<unknown> }>) {
  const t = useTranslations("announcements");
  const tRoles = useTranslations("roles");
  const tCommon = useTranslations("common");
  const errorMessage = useApiErrorMessage();
  const validationMessage = useValidationMessage();
  const school = useCurrentSchool();
  const schoolWide = useHasRole("admin", "coordinator", "admissions_officer", "finance_officer");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState<RichTextNode | null>(null);
  const [audience, setAudience] = useState<AnnouncementAudience>(schoolWide ? "school" : "class");
  const [target, setTarget] = useState("");
  const [when, setWhen] = useState<"now" | "later">("now");
  const [publishAt, setPublishAt] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const classes = useQuery({ ...getClassesQueryOptions({ mine: !schoolWide }), enabled: open && audience === "class" });
  const divisions = useQuery({ ...getDivisionsQueryOptions(), enabled: open && audience === "division" });
  const grades = useQuery({ ...getGradeLevelsQueryOptions(), enabled: open && audience === "grade_level" });
  const audiences: AnnouncementAudience[] = schoolWide ? ["school", "division", "grade_level", "class", "role"] : ["class"];
  const targets =
    audience === "class"
      ? (classes.data ?? []).map((entry) => ({ value: entry.id, label: entry.name }))
      : audience === "division"
        ? (divisions.data ?? []).map((entry) => ({ value: entry.id, label: entry.name }))
        : audience === "grade_level"
          ? (grades.data ?? [])
          : audience === "role"
            ? ROLES.filter((role) => role !== "applicant").map((role) => ({ value: role, label: tRoles(role) }))
            : [];

  const reset = () => {
    setTitle("");
    setBody(null);
    setAudience(schoolWide ? "school" : "class");
    setTarget("");
    setWhen("now");
    setPublishAt("");
    setErrors({});
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const missing: Record<string, string> = {};
    const required = validationMessage("required")!;
    if (!title.trim()) missing.title = required;
    if (isEmptyRichText(body)) missing.body = required;
    if (audience !== "school" && !target) missing.target = required;
    if (when === "later" && !publishAt) missing.publishAt = required;
    setErrors(missing);
    if (Object.keys(missing).length > 0) return;
    setSending(true);
    setError(null);
    try {
      await onSend({
        title: title.trim(),
        body: body!,
        audience,
        audienceId: audience === "school" || audience === "role" ? null : target,
        audienceRole: audience === "role" ? target : null,
        publishAt: when === "later" ? publishAt : null,
      });
      toast.success(when === "later" ? t("form.scheduledToast") : t("form.sent"));
      setOpen(false);
    } catch (sendError) {
      const fields = getFieldErrors(sendError);
      if (fields.publishAt) setErrors({ publishAt: validationMessage(fields.publishAt[0])! });
      else setError(errorMessage(sendError));
    } finally {
      setSending(false);
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
      <DialogTrigger render={<Button />}>
        <PenSquareIcon aria-hidden />
        {t("new")}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{t("form.title")}</DialogTitle>
            <DialogDescription>{t("form.description")}</DialogDescription>
          </DialogHeader>
          <FormAlert message={error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Choice
              id="announcement-audience"
              label={t("form.audience")}
              value={audience}
              onChange={(value) => {
                setAudience(value as AnnouncementAudience);
                setTarget("");
              }}
              items={audiences.map((value) => ({ value, label: t(`audiences.${value}`) }))}
            />
            {audience !== "school" && (
              <div className="flex flex-col gap-1">
                <Choice
                  id="announcement-target"
                  label={audience === "role" ? t("form.role") : t("form.target")}
                  value={target}
                  onChange={setTarget}
                  items={targets}
                />
                {errors.target && <p className="text-destructive text-sm">{errors.target}</p>}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="announcement-title">{t("form.name")}</Label>
            <Input
              id="announcement-title"
              value={title}
              aria-invalid={Boolean(errors.title)}
              onChange={(event) => setTitle(event.target.value)}
            />
            {errors.title && <p className="text-destructive text-sm">{errors.title}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="announcement-body">{t("form.body")}</Label>
            <RichTextEditor id="announcement-body" label={t("form.body")} value={body} onChange={setBody} invalid={Boolean(errors.body)} />
            {errors.body && <p className="text-destructive text-sm">{errors.body}</p>}
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t("form.when")}</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              {(["now", "later"] as const).map((option) => (
                <label key={option} className="flex items-center gap-2">
                  <input type="radio" name="announcement-when" checked={when === option} onChange={() => setWhen(option)} />
                  {t(`form.${option}`)}
                </label>
              ))}
            </div>
            {when === "later" && (
              <div className="flex w-full flex-col gap-1.5 sm:w-64">
                <Label htmlFor="announcement-at">{t("form.publishAt")}</Label>
                <Input
                  id="announcement-at"
                  type="datetime-local"
                  value={publishAt}
                  aria-describedby="announcement-at-hint"
                  aria-invalid={Boolean(errors.publishAt)}
                  onChange={(event) => setPublishAt(event.target.value)}
                />
                <p id="announcement-at-hint" className="text-muted-foreground text-xs">
                  {t("form.timeZoneNote", { timeZone: school.timeZone })}
                </p>
                {errors.publishAt && <p className="text-destructive text-sm">{errors.publishAt}</p>}
              </div>
            )}
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={sending}>
              {when === "later" ? t("form.schedule") : t("form.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
