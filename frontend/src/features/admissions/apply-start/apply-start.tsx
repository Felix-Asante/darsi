"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { useRouter } from "@/common/i18n/navigation";
import { api } from "@/common/service/api";
import { isUnauthenticatedError } from "@/common/utils/errors";
import { FormAlert } from "@/components/form/form-alert";
import { Skeleton } from "@/components/ui/skeleton";

/** After signing up or in from the application page: joins the school as an applicant family. */
export function ApplyStart() {
  const t = useTranslations("admissions.apply");
  const router = useRouter();
  const queryClient = useQueryClient();
  const errorMessage = useApiErrorMessage();
  const join = useMutation({
    mutationFn: () => api.admissions.join(),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      router.replace("/applications");
    },
    onError: (error) => {
      if (isUnauthenticatedError(error))
        router.replace({
          pathname: "/sign-in",
          query: { next: "/apply/start" },
        });
    },
  });
  const { mutate } = join;

  useEffect(() => {
    mutate();
  }, [mutate]);

  if (join.isError && !isUnauthenticatedError(join.error)) {
    return (
      <div className="w-full max-w-md">
        <FormAlert message={errorMessage(join.error)} />
      </div>
    );
  }
  return (
    <div className="flex w-full max-w-md flex-col gap-3" aria-busy="true">
      <p className="text-sm">{t("joining")}</p>
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
