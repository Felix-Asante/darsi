"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ROLES, type Role } from "@/common/auth/roles";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { FormAlert } from "@/components/form/form-alert";
import { TextField } from "@/components/form/text-field";
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
import { FieldGroup } from "@/components/ui/field";
import { RoleCheckboxes } from "./role-checkboxes";

const inviteSchema = z.object({
  email: z.email({ error: "email" }),
  roles: z.array(z.enum(ROLES)).min(1, { error: "rolesRequired" }),
});

type InviteValues = z.infer<typeof inviteSchema>;

interface InviteDialogProps {
  onInvite: (values: { email: string; roles: Role[] }) => Promise<unknown>;
}

export function InviteDialog({ onInvite }: Readonly<InviteDialogProps>) {
  const t = useTranslations("settings.invite");
  const tCommon = useTranslations("common");
  const errorMessage = useApiErrorMessage();
  const validationMessage = useValidationMessage();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<InviteValues>({ resolver: zodResolver(inviteSchema), defaultValues: { email: "", roles: [] } });

  const onSubmit = form.handleSubmit((values) =>
    onInvite(values).then(
      () => {
        toast.success(t("sent", { email: values.email }));
        form.reset();
        setOpen(false);
      },
      (error: unknown) => setServerError(errorMessage(error)),
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
        <UserPlusIcon aria-hidden />
        {t("title")}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <FormAlert message={serverError} />
          <FieldGroup>
            <TextField control={form.control} name="email" type="email" label={t("email")} autoComplete="off" />
            <Controller
              control={form.control}
              name="roles"
              render={({ field, fieldState }) => (
                <RoleCheckboxes
                  legend={t("roles")}
                  value={field.value}
                  onChange={field.onChange}
                  error={validationMessage(fieldState.error?.message)}
                />
              )}
            />
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
