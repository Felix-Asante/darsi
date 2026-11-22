"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { env } from "@/common/config/env";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { Link, useRouter } from "@/common/i18n/navigation";
import { localizedPath, safeNextPath } from "@/common/i18n/paths";
import { FormAlert } from "@/components/form/form-alert";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { FieldGroup, FieldSeparator } from "@/components/ui/field";
import { AuthCard } from "../_shared/auth-card";
import { type SignInValues, signInSchema } from "./sign-in.schema";
import { useGoogleSignIn, useSignIn } from "./use-sign-in";

export function SignInForm() {
  const t = useTranslations("auth.signIn");
  const tCommon = useTranslations("common");
  const errorMessage = useApiErrorMessage();
  const locale = useLocale();
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));
  const signIn = useSignIn();
  const google = useGoogleSignIn();
  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const callbackURL = `${window.location.origin}${localizedPath(locale, next)}`;
    await signIn.mutateAsync({ ...values, callbackURL }).then(
      () => {
        // Routes prefetched while signed out were redirects to this page; drop them.
        router.refresh();
        router.replace(next);
      },
      () => undefined,
    );
  });

  const error = signIn.error ?? google.error;

  return (
    <AuthCard
      title={t("title")}
      description={t("description")}
      footer={
        <>
          {t("noAccount")}{" "}
          <Link
            href={{ pathname: "/sign-up", query: next !== "/" ? { next } : {} }}
            className="text-primary font-medium hover:underline"
          >
            {t("signUpLink")}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <FormAlert message={error ? errorMessage(error) : null} />
        <FieldGroup>
          <TextField
            control={form.control}
            name="email"
            type="email"
            label={tCommon("email")}
            autoComplete="email"
            autoFocus
          />
          <TextField
            control={form.control}
            name="password"
            type="password"
            label={tCommon("password")}
            autoComplete="current-password"
          />
        </FieldGroup>
        <div className="flex flex-col gap-3">
          <Button type="submit" size="lg" disabled={signIn.isPending}>
            {t("submit")}
          </Button>
          <Link
            href="/forgot-password"
            className="text-primary self-center text-sm hover:underline"
          >
            {t("forgot")}
          </Link>
        </div>
        {env.NEXT_PUBLIC_GOOGLE_SIGN_IN && (
          <>
            <FieldSeparator>{tCommon("or")}</FieldSeparator>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={google.isPending}
              onClick={() =>
                google.mutate(
                  `${window.location.origin}${localizedPath(locale, next)}`,
                )
              }
            >
              {t("google")}
            </Button>
          </>
        )}
      </form>
    </AuthCard>
  );
}
