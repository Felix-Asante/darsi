"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import type { BellScheduleInput } from "@/common/types/calendar";
import { applyServerErrors } from "@/components/form/apply-server-errors";
import { FormAlert } from "@/components/form/form-alert";
import { type SelectOption, SelectField } from "@/components/form/select-field";
import { TextField } from "@/components/form/text-field";
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
import { FieldGroup } from "@/components/ui/field";

const WHOLE_SCHOOL = "";

const scheduleSchema = z.object({
  name: z.string().trim().min(1, { error: "required" }).max(80),
  divisionId: z.string(),
  rotationKind: z.enum(["weekly", "cycle"]),
  rotationLength: z.string().regex(/^([1-9]|1\d|20)$/, { error: "required" }),
});

type ScheduleValues = z.infer<typeof scheduleSchema>;

const DEFAULTS: ScheduleValues = { name: "", divisionId: WHOLE_SCHOOL, rotationKind: "weekly", rotationLength: "1" };

export function CreateScheduleDialog({
  divisions,
  onCreate,
}: Readonly<{ divisions: SelectOption[]; onCreate: (input: BellScheduleInput) => Promise<unknown> }>) {
  const t = useTranslations("timetableSettings");
  const tCommon = useTranslations("common");
  const errorMessage = useApiErrorMessage();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<ScheduleValues>({ resolver: zodResolver(scheduleSchema), defaultValues: DEFAULTS });
  const rotationKind = useWatch({ control: form.control, name: "rotationKind" });

  const onSubmit = form.handleSubmit((values) =>
    onCreate({
      name: values.name,
      divisionId: values.divisionId || null,
      rotationKind: values.rotationKind,
      rotationLength: Number(values.rotationLength),
    }).then(
      () => {
        toast.success(t("created", { name: values.name }));
        form.reset(DEFAULTS);
        setOpen(false);
      },
      (error: unknown) => {
        if (!applyServerErrors(error, form.setError, ["name", "divisionId", "rotationLength"])) {
          setServerError(errorMessage(error));
        }
      },
    ),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setServerError(null);
      }}
    >
      <DialogTrigger render={<Button />}>
        <PlusIcon aria-hidden />
        {t("add")}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>{t("add")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <FormAlert message={serverError} />
          <FieldGroup>
            <TextField control={form.control} name="name" label={t("name")} autoComplete="off" />
            <SelectField
              control={form.control}
              name="divisionId"
              label={t("division")}
              options={[{ value: WHOLE_SCHOOL, label: t("wholeSchool") }, ...divisions]}
            />
            <SelectField
              control={form.control}
              name="rotationKind"
              label={t("rotation")}
              options={[
                { value: "weekly", label: t("rotations.weekly") },
                { value: "cycle", label: t("rotations.cycle") },
              ]}
            />
            <SelectField
              control={form.control}
              name="rotationLength"
              label={rotationKind === "weekly" ? t("weeks") : t("days")}
              options={Array.from({ length: rotationKind === "weekly" ? 4 : 20 }, (_, index) => ({
                value: String(index + 1),
                label: String(index + 1),
              }))}
            />
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {t("add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
