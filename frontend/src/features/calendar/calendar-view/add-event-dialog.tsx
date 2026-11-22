"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import {
  getClassesQueryOptions,
  getDivisionsQueryOptions,
  getGradeLevelsQueryOptions,
} from "@/common/integrations/tanstack-query/query-options/academics";
import { AUDIENCES, type CalendarEventInput, EVENT_KINDS } from "@/common/types/calendar";
import { applyServerErrors } from "@/components/form/apply-server-errors";
import { FormAlert } from "@/components/form/form-alert";
import { SelectField } from "@/components/form/select-field";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

const REPEATS = ["none", "weekly", "monthly", "yearly"] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const eventSchema = z
  .object({
    title: z.string().trim().min(1, { error: "required" }).max(200),
    kind: z.enum(EVENT_KINDS),
    startsOn: z.string().regex(DATE, { error: "required" }),
    endsOn: z.string(),
    allDay: z.boolean(),
    startTime: z.string(),
    endTime: z.string(),
    repeat: z.enum(REPEATS),
    repeatUntil: z.string(),
    audience: z.enum(AUDIENCES),
    audienceId: z.string(),
  })
  .superRefine((values, context) => {
    if (values.endsOn && values.endsOn < values.startsOn) {
      context.addIssue({ code: "custom", path: ["endsOn"], message: "afterStart" });
    }
    if (!values.allDay && !values.startTime) context.addIssue({ code: "custom", path: ["startTime"], message: "required" });
    if (!values.allDay && !values.endTime) context.addIssue({ code: "custom", path: ["endTime"], message: "required" });
    if (!values.allDay && values.startTime && values.endTime && values.endTime <= values.startTime) {
      context.addIssue({ code: "custom", path: ["endTime"], message: "afterStart" });
    }
    if (values.audience !== "school" && !values.audienceId) {
      context.addIssue({ code: "custom", path: ["audienceId"], message: "required" });
    }
  });

type EventValues = z.infer<typeof eventSchema>;

const FIELDS = ["title", "startsOn", "endsOn", "startTime", "endTime", "audienceId"] as const;

function toInput(values: EventValues): CalendarEventInput {
  const until = values.repeatUntil.replaceAll("-", "");
  return {
    title: values.title,
    kind: values.kind,
    startsOn: values.startsOn,
    endsOn: values.endsOn || values.startsOn,
    startTime: values.allDay ? null : values.startTime,
    endTime: values.allDay ? null : values.endTime,
    recurrence:
      values.repeat === "none" ? null : `FREQ=${values.repeat.toUpperCase()}${until ? `;UNTIL=${until}` : ""}`,
    audience: values.audience,
    audienceId: values.audience === "school" ? null : values.audienceId,
  };
}

export function AddEventDialog({
  defaultDate,
  onCreate,
}: Readonly<{ defaultDate: string; onCreate: (input: CalendarEventInput) => Promise<unknown> }>) {
  const t = useTranslations("calendar");
  const tCommon = useTranslations("common");
  const errorMessage = useApiErrorMessage();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const defaults: EventValues = {
    title: "",
    kind: "event",
    startsOn: defaultDate,
    endsOn: "",
    allDay: true,
    startTime: "",
    endTime: "",
    repeat: "none",
    repeatUntil: "",
    audience: "school",
    audienceId: "",
  };
  const form = useForm<EventValues>({ resolver: zodResolver(eventSchema), defaultValues: defaults });
  const [allDay, repeat, audience] = useWatch({ control: form.control, name: ["allDay", "repeat", "audience"] });
  useEffect(() => form.resetField("audienceId"), [audience, form]);
  const divisions = useQuery({ ...getDivisionsQueryOptions(), enabled: open && audience === "division" });
  const gradeLevels = useQuery({ ...getGradeLevelsQueryOptions(), enabled: open && audience === "grade_level" });
  const classes = useQuery({ ...getClassesQueryOptions(), enabled: open && audience === "class" });

  const targets =
    audience === "division"
      ? (divisions.data ?? []).map((division) => ({ value: division.id, label: division.name }))
      : audience === "grade_level"
        ? (gradeLevels.data ?? [])
        : (classes.data ?? []).map((schoolClass) => ({ value: schoolClass.id, label: schoolClass.name }));

  const onSubmit = form.handleSubmit((values) =>
    onCreate(toInput(values)).then(
      () => {
        toast.success(t("form.created", { title: values.title }));
        form.reset(defaults);
        setOpen(false);
      },
      (error: unknown) => {
        if (!applyServerErrors(error, form.setError, FIELDS)) setServerError(errorMessage(error));
      },
    ),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) form.reset(defaults);
        setServerError(null);
      }}
    >
      <DialogTrigger render={<Button />}>
        <PlusIcon aria-hidden />
        {t("add")}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>{t("form.title")}</DialogTitle>
            <DialogDescription>{t("form.description")}</DialogDescription>
          </DialogHeader>
          <FormAlert message={serverError} />
          <FieldGroup>
            <TextField control={form.control} name="title" label={t("form.name")} autoComplete="off" />
            <SelectField
              control={form.control}
              name="kind"
              label={t("form.kind")}
              options={EVENT_KINDS.map((kind) => ({ value: kind, label: t(`kinds.${kind}`) }))}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="startsOn" type="date" label={t("form.startsOn")} />
              <TextField
                control={form.control}
                name="endsOn"
                type="date"
                label={`${t("form.endsOn")} (${tCommon("optional")})`}
              />
            </div>
            <Controller
              control={form.control}
              name="allDay"
              render={({ field }) => (
                <Field orientation="horizontal">
                  <Checkbox id="allDay" checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                  <FieldLabel htmlFor="allDay" className="font-normal">
                    {t("form.allDay")}
                  </FieldLabel>
                </Field>
              )}
            />
            {!allDay && (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField control={form.control} name="startTime" type="time" label={t("form.startTime")} />
                <TextField control={form.control} name="endTime" type="time" label={t("form.endTime")} />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                control={form.control}
                name="repeat"
                label={t("form.repeat")}
                options={REPEATS.map((value) => ({ value, label: t(`form.repeats.${value}`) }))}
              />
              {repeat !== "none" && (
                <TextField
                  control={form.control}
                  name="repeatUntil"
                  type="date"
                  label={`${t("form.repeatUntil")} (${tCommon("optional")})`}
                />
              )}
            </div>
            <SelectField
              control={form.control}
              name="audience"
              label={t("form.audience")}
              options={AUDIENCES.map((value) => ({ value, label: t(`form.audiences.${value}`) }))}
            />
            {audience !== "school" && (
              <SelectField control={form.control} name="audienceId" label={t("form.audienceTarget")} options={targets} />
            )}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {t("form.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
