"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { Link } from "@/common/i18n/navigation";
import { localizedPath } from "@/common/i18n/paths";
import { api } from "@/common/service/api";
import { FormAlert } from "@/components/form/form-alert";
import { captchaEnabled, Turnstile } from "@/components/form/turnstile";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { AuthCard } from "../_shared/auth-card";
import { emailSchema } from "../_shared/auth.schemas";

const forgotPasswordSchema = z.object({ email: emailSchema });

export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgot");
  const tCommon = useTranslations("common");
  const errorMessage = useApiErrorMessage();
  const locale = useLocale();
  const form = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const request = useMutation({
    mutationFn: ({ email }: { email: string }) =>
      api.auth.requestPasswordReset(
        {
          email,
          redirectTo: `${window.location.origin}${localizedPath(locale, "/reset-password")}`,
        },
        captchaToken,
      ),
  });

  const backToSignIn = (
    <Link href="/sign-in" className="text-primary font-medium hover:underline">
      {t("backToSignIn")}
    </Link>
  );

  if (request.isSuccess) {
    return (
      <AuthCard
        title={t("sentTitle")}
        description={t("sent", { email: form.getValues("email") })}
        footer={backToSignIn}
      />
    );
  }

  return (
    <AuthCard
      title={t("title")}
      description={t("description")}
      footer={backToSignIn}
    >
      <form
        onSubmit={form.handleSubmit((values) => request.mutate(values))}
        noValidate
        className="flex flex-col gap-5"
      >
        <FormAlert
          message={request.error ? errorMessage(request.error) : null}
        />
        <TextField
          control={form.control}
          name="email"
          type="email"
          label={tCommon("email")}
          autoComplete="email"
          autoFocus
        />
        <Turnstile onToken={setCaptchaToken} />
        <Button
          type="submit"
          size="lg"
          disabled={request.isPending || (captchaEnabled && !captchaToken)}
        >
          {t("submit")}
        </Button>
      </form>
    </AuthCard>
  );
}
