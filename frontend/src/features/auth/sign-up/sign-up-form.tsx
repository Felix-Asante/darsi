"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { Link, useRouter } from "@/common/i18n/navigation";
import { localizedPath, safeNextPath } from "@/common/i18n/paths";
import { api } from "@/common/service/api";
import { FormAlert } from "@/components/form/form-alert";
import { captchaEnabled, Turnstile } from "@/components/form/turnstile";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { AuthCard } from "../_shared/auth-card";
import { type SignUpValues, signUpSchema } from "./sign-up.schema";

export function SignUpForm() {
  const t = useTranslations("auth.signUp");
  const tCommon = useTranslations("common");
  const errorMessage = useApiErrorMessage();
  const locale = useLocale();
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));
  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "" },
  });
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const signUp = useMutation({
    mutationFn: (values: SignUpValues) =>
      api.auth.signUp(
        {
          ...values,
          locale,
          callbackURL: `${window.location.origin}${localizedPath(locale, next)}`,
        },
        captchaToken,
      ),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await signUp.mutateAsync(values).then(
      () =>
        router.push({
          pathname: "/verify-email",
          query: { email: values.email, next },
        }),
      () => undefined,
    );
  });

  return (
    <AuthCard
      title={t("title")}
      description={t("description")}
      footer={
        <>
          {t("hasAccount")}{" "}
          <Link
            href={{ pathname: "/sign-in", query: next !== "/" ? { next } : {} }}
            className="text-primary font-medium hover:underline"
          >
            {t("signInLink")}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <FormAlert message={signUp.error ? errorMessage(signUp.error) : null} />
        <FieldGroup>
          <TextField
            control={form.control}
            name="name"
            label={tCommon("name")}
            autoComplete="name"
            autoFocus
          />
          <TextField
            control={form.control}
            name="email"
            type="email"
            label={tCommon("email")}
            autoComplete="email"
          />
          <TextField
            control={form.control}
            name="password"
            type="password"
            label={tCommon("password")}
            description={t("passwordHint")}
            autoComplete="new-password"
          />
        </FieldGroup>
        <Turnstile onToken={setCaptchaToken} />
        <Button
          type="submit"
          size="lg"
          disabled={signUp.isPending || (captchaEnabled && !captchaToken)}
        >
          {t("submit")}
        </Button>
      </form>
    </AuthCard>
  );
}
