"use client";

import { useMutation } from "@tanstack/react-query";
import { MailCheckIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { Link } from "@/common/i18n/navigation";
import { localizedPath, safeNextPath } from "@/common/i18n/paths";
import { api } from "@/common/service/api";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { AuthCard } from "../_shared/auth-card";

export function VerifyEmailNotice() {
  const t = useTranslations("auth.verify");
  const errorMessage = useApiErrorMessage();
  const locale = useLocale();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const next = safeNextPath(params.get("next"));
  const resend = useMutation({
    mutationFn: () =>
      api.auth.resendVerification({
        email,
        callbackURL: `${window.location.origin}${localizedPath(locale, next)}`,
      }),
  });

  return (
    <AuthCard
      title={t("title")}
      description={t("description", { email })}
      footer={
        <>
          {t("wrongEmail")}{" "}
          <Link
            href="/sign-up"
            className="text-primary font-medium hover:underline"
          >
            {t("startOver")}
          </Link>
        </>
      }
    >
      <MailCheckIcon aria-hidden className="text-primary size-8" />
      <FormAlert message={resend.error ? errorMessage(resend.error) : null} />
      <p role="status" className="text-success text-sm">
        {resend.isSuccess ? t("resent") : null}
      </p>
      <Button
        variant="outline"
        disabled={!email || resend.isPending}
        onClick={() => resend.mutate()}
      >
        {t("resend")}
      </Button>
    </AuthCard>
  );
}
