"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useCurrentSchool } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { applyServerErrors } from "@/components/form/apply-server-errors";
import { Button } from "@/components/ui/button";
import { SchoolSettingsFields } from "../_shared/school-settings-fields";
import { type SchoolSettingsValues, schoolSettingsSchema } from "../_shared/school-settings.schema";
import { useUpdateSchool } from "../_shared/use-school-mutations";

const FIELDS = ["name", "defaultLocale", "timeZone", "currency"] as const;

export function SchoolSettingsForm() {
  const t = useTranslations("settings.school");
  const tCommon = useTranslations("common");
  const errorMessage = useApiErrorMessage();
  const school = useCurrentSchool();
  const update = useUpdateSchool();
  const form = useForm<SchoolSettingsValues>({
    resolver: zodResolver(schoolSettingsSchema),
    values: {
      name: school.name,
      defaultLocale: school.defaultLocale,
      timeZone: school.timeZone,
      currency: school.currency,
    },
  });

  const onSubmit = form.handleSubmit((values) =>
    update.mutateAsync(values).then(
      () => toast.success(tCommon("saved")),
      (error: unknown) => {
        if (!applyServerErrors(error, form.setError, FIELDS)) toast.error(errorMessage(error));
      },
    ),
  );

  return (
    <section aria-labelledby="school-settings-title" className="flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 id="school-settings-title" className="text-lg font-semibold tracking-tight">
          {t("title")}
        </h2>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        <SchoolSettingsFields control={form.control} />
        <Button type="submit" className="self-start" disabled={update.isPending || !form.formState.isDirty}>
          {t("submit")}
        </Button>
      </form>
    </section>
  );
}
