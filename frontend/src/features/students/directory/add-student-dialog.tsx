"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { useRouter } from "@/common/i18n/navigation";
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
import { useCreateStudent } from "./use-students";

const CODE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;

const studentSchema = z.object({
  studentNumber: z
    .string()
    .trim()
    .min(1, { error: "required" })
    .regex(CODE, { error: "matches" }),
  firstName: z.string().trim().min(1, { error: "required" }).max(80),
  lastName: z.string().trim().min(1, { error: "required" }).max(80),
  preferredName: z.string().trim().max(80),
  dateOfBirth: z.string(),
  email: z.union([z.literal(""), z.email({ error: "email" })]),
  gradeLevelId: z.string(),
});

type StudentValues = z.infer<typeof studentSchema>;

const FIELDS = [
  "studentNumber",
  "firstName",
  "lastName",
  "preferredName",
  "dateOfBirth",
  "email",
  "gradeLevelId",
] as const;
const EMPTY: StudentValues = {
  studentNumber: "",
  firstName: "",
  lastName: "",
  preferredName: "",
  dateOfBirth: "",
  email: "",
  gradeLevelId: "",
};

export function AddStudentDialog({
  gradeLevels,
}: Readonly<{ gradeLevels: SelectOption[] }>) {
  const t = useTranslations("students.form");
  const tStudents = useTranslations("students");
  const tCommon = useTranslations("common");
  const errorMessage = useApiErrorMessage();
  const router = useRouter();
  const createStudent = useCreateStudent();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<StudentValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: EMPTY,
  });

  const onSubmit = form.handleSubmit((values) =>
    createStudent
      .mutateAsync({
        studentNumber: values.studentNumber,
        firstName: values.firstName,
        lastName: values.lastName,
        preferredName: values.preferredName || null,
        dateOfBirth: values.dateOfBirth || null,
        email: values.email || null,
        gradeLevelId: values.gradeLevelId || null,
      })
      .then(
        (student) => {
          toast.success(
            t("created", { name: `${student.firstName} ${student.lastName}` }),
          );
          form.reset(EMPTY);
          setOpen(false);
          router.push(`/students/${student.id}`);
        },
        (error: unknown) => {
          if (!applyServerErrors(error, form.setError, FIELDS))
            setServerError(errorMessage(error));
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
        {tStudents("add")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <FormAlert message={serverError} />
          <FieldGroup>
            <TextField
              control={form.control}
              name="studentNumber"
              label={t("studentNumber")}
              autoComplete="off"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                control={form.control}
                name="firstName"
                label={t("firstName")}
                autoComplete="off"
              />
              <TextField
                control={form.control}
                name="lastName"
                label={t("lastName")}
                autoComplete="off"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                control={form.control}
                name="preferredName"
                label={`${t("preferredName")} (${tCommon("optional")})`}
                autoComplete="off"
              />
              <TextField
                control={form.control}
                name="dateOfBirth"
                type="date"
                label={`${t("dateOfBirth")} (${tCommon("optional")})`}
              />
            </div>
            <SelectField
              control={form.control}
              name="gradeLevelId"
              label={t("gradeLevel")}
              options={gradeLevels}
              placeholder={t("noGrade")}
            />
            <TextField
              control={form.control}
              name="email"
              type="email"
              label={`${t("email")} (${tCommon("optional")})`}
              description={t("emailHint")}
              autoComplete="off"
            />
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
