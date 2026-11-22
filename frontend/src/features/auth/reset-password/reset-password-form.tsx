"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { Link } from "@/common/i18n/navigation";
import { api } from "@/common/service/api";
import { FormAlert } from "@/components/form/form-alert";
import { TextField } from "@/components/form/text-field";
import { buttonVariants, Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { AuthCard } from "../_shared/auth-card";
import { newPasswordSchema } from "../_shared/auth.schemas";

const resetPasswordSchema = z
  .object({ password: newPasswordSchema, confirmation: z.string() })
  .refine((values) => values.password === values.confirmation, {
    path: ["confirmation"],
    error: "passwordsMatch",
  });

export function ResetPasswordForm() {
  const t = useTranslations("auth.reset");
  const tAuth = useTranslations("auth");
  const errorMessage = useApiErrorMessage();
  const params = useSearchParams();
  const token = params.get("token");
  const linkError = params.get("error");
  const form = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmation: "" },
  });
  const reset = useMutation({
    mutationFn: (newPassword: string) =>
      api.auth.resetPassword({ token: token ?? "", newPassword }),
  });

  const signInLink = (
    <Link href="/sign-in" className={buttonVariants({ size: "lg" })}>
      {tAuth("signIn.submit")}
    </Link>
  );

  if (!token || linkError) {
    return (
      <AuthCard title={t("title")}>
        <FormAlert message={t("missingToken")} />
        <Link
          href="/forgot-password"
          className="text-primary text-sm font-medium hover:underline"
        >
          {tAuth("forgot.title")}
        </Link>
      </AuthCard>
    );
  }

  if (reset.isSuccess) {
    return (
      <AuthCard title={t("doneTitle")} description={t("done")}>
        {signInLink}
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("title")} description={t("description")}>
      <form
        onSubmit={form.handleSubmit(({ password }) => reset.mutate(password))}
        noValidate
        className="flex flex-col gap-5"
      >
        <FormAlert message={reset.error ? errorMessage(reset.error) : null} />
        <FieldGroup>
          <TextField
            control={form.control}
            name="password"
            type="password"
            label={t("newPassword")}
            autoComplete="new-password"
            autoFocus
          />
          <TextField
            control={form.control}
            name="confirmation"
            type="password"
            label={t("confirmPassword")}
            autoComplete="new-password"
          />
        </FieldGroup>
        <Button type="submit" size="lg" disabled={reset.isPending}>
          {t("submit")}
        </Button>
      </form>
    </AuthCard>
  );
}
