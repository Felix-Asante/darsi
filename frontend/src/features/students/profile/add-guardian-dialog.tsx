"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlusIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { RELATIONSHIPS } from "@/common/types/people";
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
import type { AddGuardianInput } from "./use-student";

const guardianSchema = z.object({
  email: z.email({ error: "email" }),
  firstName: z.string().trim().min(1, { error: "required" }).max(80),
  lastName: z.string().trim().min(1, { error: "required" }).max(80),
  phone: z.string().trim().max(40),
  relationship: z.enum(RELATIONSHIPS),
  preferredLocale: z.enum(["en", "fr"]),
  isPrimaryContact: z.boolean(),
});

type GuardianValues = z.infer<typeof guardianSchema>;

const FIELDS = ["email", "firstName", "lastName", "phone"] as const;

interface AddGuardianDialogProps {
  hasGuardians: boolean;
  onAdd: (input: AddGuardianInput) => Promise<unknown>;
}

export function AddGuardianDialog({
  hasGuardians,
  onAdd,
}: Readonly<AddGuardianDialogProps>) {
  const t = useTranslations("students.guardians");
  const tCommon = useTranslations("common");
  const tLocale = useTranslations("locale");
  const locale = useLocale();
  const errorMessage = useApiErrorMessage();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const defaults: GuardianValues = {
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    relationship: "parent",
    preferredLocale: locale === "fr" ? "fr" : "en",
    isPrimaryContact: !hasGuardians,
  };
  const form = useForm<GuardianValues>({
    resolver: zodResolver(guardianSchema),
    defaultValues: defaults,
  });

  const onSubmit = form.handleSubmit((values) =>
    onAdd({ ...values, phone: values.phone || null }).then(
      () => {
        toast.success(
          t("form.linked", { name: `${values.firstName} ${values.lastName}` }),
        );
        form.reset(defaults);
        setOpen(false);
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
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <UserPlusIcon aria-hidden />
        {t("add")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>{t("form.title")}</DialogTitle>
            <DialogDescription>{t("form.description")}</DialogDescription>
          </DialogHeader>
          <FormAlert message={serverError} />
          <FieldGroup>
            <TextField
              control={form.control}
              name="email"
              type="email"
              label={t("form.email")}
              autoComplete="off"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                control={form.control}
                name="firstName"
                label={t("form.firstName")}
                autoComplete="off"
              />
              <TextField
                control={form.control}
                name="lastName"
                label={t("form.lastName")}
                autoComplete="off"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                control={form.control}
                name="relationship"
                label={t("form.relationship")}
                options={RELATIONSHIPS.map((value) => ({
                  value,
                  label: t(`relationships.${value}`),
                }))}
              />
              <SelectField
                control={form.control}
                name="preferredLocale"
                label={t("form.preferredLocale")}
                options={[
                  { value: "en", label: tLocale("en") },
                  { value: "fr", label: tLocale("fr") },
                ]}
              />
            </div>
            <TextField
              control={form.control}
              name="phone"
              label={`${t("form.phone")} (${tCommon("optional")})`}
              autoComplete="off"
            />
            <Controller
              control={form.control}
              name="isPrimaryContact"
              render={({ field }) => (
                <Field orientation="horizontal">
                  <Checkbox
                    id="isPrimaryContact"
                    checked={field.value}
                    onCheckedChange={(checked) =>
                      field.onChange(checked === true)
                    }
                  />
                  <FieldLabel
                    htmlFor="isPrimaryContact"
                    className="font-normal"
                  >
                    {t("form.isPrimaryContact")}
                  </FieldLabel>
                </Field>
              )}
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
              {t("form.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
