"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { getNotificationPreferencesQueryOptions } from "@/common/integrations/tanstack-query/query-options/notifications";
import { api } from "@/common/service/api";
import type { NotificationPreference } from "@/common/types/daily";
import { FormAlert } from "@/components/form/form-alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

export function NotificationPreferences() {
  const t = useTranslations("notificationSettings");
  const errorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const preferences = useQuery(getNotificationPreferencesQueryOptions());
  const save = useMutation({
    mutationFn: (preference: NotificationPreference) => api.notifications.savePreference(preference),
    onMutate: (preference) =>
      queryClient.setQueryData<NotificationPreference[]>(queryKeys.notifications.preferences(), (current) =>
        current?.map((entry) => (entry.type === preference.type ? preference : entry)),
      ),
    onSuccess: () => toast.success(t("saved")),
    onError: (error) => {
      toast.error(errorMessage(error));
      return queryClient.invalidateQueries({ queryKey: queryKeys.notifications.preferences() });
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>
      <FormAlert message={preferences.error ? errorMessage(preferences.error) : null} />
      {preferences.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <table className="bg-card w-full overflow-hidden rounded-lg border text-sm">
          <thead>
            <tr className="border-b">
              <th scope="col" className="px-4 py-2 text-start font-medium">
                {t("type")}
              </th>
              <th scope="col" className="px-4 py-2 text-center font-medium">
                {t("inApp")}
              </th>
              <th scope="col" className="px-4 py-2 text-center font-medium">
                {t("email")}
              </th>
            </tr>
          </thead>
          <tbody>
            {(preferences.data ?? []).map((preference) => {
              const label = t(`types.${preference.type.replace(".", "_")}` as "types.grade_published");
              return (
                <tr key={preference.type} className="border-b last:border-b-0">
                  <th scope="row" className="px-4 py-3 text-start font-normal">
                    {label}
                  </th>
                  {(["inApp", "email"] as const).map((channel) => (
                    <td key={channel} className="px-4 py-3 text-center">
                      <Checkbox
                        aria-label={`${label}: ${t(channel)}`}
                        checked={preference[channel]}
                        onCheckedChange={(checked) => save.mutate({ ...preference, [channel]: checked === true })}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
