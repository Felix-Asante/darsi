"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { useCurrentSchool } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { useRouter } from "@/common/i18n/navigation";
import { applyServerErrors } from "@/components/form/apply-server-errors";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { SchoolSettingsFields } from "../_shared/school-settings-fields";
import { type SchoolSettingsValues, schoolSettingsSchema } from "../_shared/school-settings.schema";
import { useCompleteOnboarding } from "../_shared/use-school-mutations";

const FIELDS = ["name", "defaultLocale", "timeZone", "currency"] as const;

export function OnboardingForm() {
  const t = useTranslations("onboarding");
  const errorMessage = useApiErrorMessage();
  const router = useRouter();
  const school = useCurrentSchool();
  const complete = useCompleteOnboarding();
  const form = useForm<SchoolSettingsValues>({
    resolver: zodResolver(schoolSettingsSchema),
    defaultValues: {
      name: school.name,
      defaultLocale: school.defaultLocale,
      timeZone: school.timeZone,
      currency: school.currency,
    },
  });

  const onSubmit = form.handleSubmit((values) =>
    complete.mutateAsync(values).then(
      () => router.replace("/"),
      (error: unknown) => applyServerErrors(error, form.setError, FIELDS),
    ),
  );

  const serverError = complete.error && !form.formState.errors.timeZone && !form.formState.errors.currency;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10 sm:py-16">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>
      <form onSubmit={onSubmit} noValidate className="bg-card flex flex-col gap-6 rounded-xl border p-6">
        <FormAlert message={serverError ? errorMessage(complete.error) : null} />
        <SchoolSettingsFields control={form.control} />
        <Button type="submit" size="lg" disabled={complete.isPending}>
          {t("submit")}
        </Button>
      </form>
    </main>
  );
}
