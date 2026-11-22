"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import {
  getGradeLevelsQueryOptions,
  getSubjectsQueryOptions,
} from "@/common/integrations/tanstack-query/query-options/academics";
import type { ClassInput, SchoolClass } from "@/common/types/academics";
import { applyServerErrors } from "@/components/form/apply-server-errors";
import { FormAlert } from "@/components/form/form-alert";
import { SelectField } from "@/components/form/select-field";
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

const CODE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;

const classSchema = z.object({
  code: z.string().trim().min(1, { error: "required" }).regex(CODE, { error: "matches" }),
  name: z.string().trim().min(1, { error: "required" }).max(120),
  subjectId: z.string(),
  gradeLevelId: z.string(),
});

type ClassValues = z.infer<typeof classSchema>;

const EMPTY: ClassValues = { code: "", name: "", subjectId: "", gradeLevelId: "" };

interface CreateClassDialogProps {
  academicYearId: string;
  onCreate: (input: ClassInput) => Promise<SchoolClass>;
}

export function CreateClassDialog({ academicYearId, onCreate }: Readonly<CreateClassDialogProps>) {
  const t = useTranslations("classes");
  const tCommon = useTranslations("common");
  const errorMessage = useApiErrorMessage();
  const subjects = useQuery(getSubjectsQueryOptions());
  const gradeLevels = useQuery(getGradeLevelsQueryOptions());
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<ClassValues>({ resolver: zodResolver(classSchema), defaultValues: EMPTY });

  const onSubmit = form.handleSubmit((values) =>
    onCreate({
      academicYearId,
      code: values.code,
      name: values.name,
      subjectId: values.subjectId || null,
      gradeLevelId: values.gradeLevelId || null,
    }).then(
      (created) => {
        toast.success(t("form.created", { name: created.name }));
        form.reset(EMPTY);
        setOpen(false);
      },
      (error: unknown) => {
        if (!applyServerErrors(error, form.setError, ["code", "name"])) setServerError(errorMessage(error));
      },
    ),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setServerError(null);
      }}
    >
      <DialogTrigger render={<Button />}>
        <PlusIcon aria-hidden />
        {t("create")}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>{t("form.title")}</DialogTitle>
            <DialogDescription>{t("form.description")}</DialogDescription>
          </DialogHeader>
          <FormAlert message={serverError} />
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
              <TextField control={form.control} name="code" label={t("form.code")} autoComplete="off" />
              <TextField control={form.control} name="name" label={t("form.name")} autoComplete="off" />
            </div>
            <SelectField
              control={form.control}
              name="subjectId"
              label={t("form.subject")}
              placeholder={t("form.noSubject")}
              options={(subjects.data ?? []).map((subject) => ({
                value: subject.id,
                label: `${subject.name} (${subject.code})`,
              }))}
            />
            <SelectField
              control={form.control}
              name="gradeLevelId"
              label={t("form.gradeLevel")}
              placeholder={t("form.noGrade")}
              options={gradeLevels.data ?? []}
            />
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
