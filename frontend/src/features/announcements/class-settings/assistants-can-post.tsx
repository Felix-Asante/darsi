"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useHasRole } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { getClassAnnouncementSettingsQueryOptions } from "@/common/integrations/tanstack-query/query-options/announcements";
import { api } from "@/common/service/api";
import { Checkbox } from "@/components/ui/checkbox";

/** For the class's teacher: whether assistants may post announcements to it (ANN-1). */
export function AssistantsCanPost({ classId }: Readonly<{ classId: string }>) {
  const t = useTranslations("announcements.classSettings");
  const errorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const isTeacher = useHasRole("teacher");
  const settings = useQuery({ ...getClassAnnouncementSettingsQueryOptions(classId), enabled: isTeacher });
  const save = useMutation({
    mutationFn: (value: boolean) => api.announcements.saveClassSettings(classId, value),
    onSuccess: (response) => {
      queryClient.setQueryData(queryKeys.announcements.classSettings(classId), response.data);
      toast.success(t("saved"));
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  if (!isTeacher || !settings.data) return null;

  return (
    <label className="bg-card flex items-center gap-3 rounded-lg border p-4 text-sm">
      <Checkbox
        checked={settings.data.assistantsCanPost}
        disabled={save.isPending}
        onCheckedChange={(checked) => save.mutate(checked === true)}
      />
      {t("assistantsCanPost")}
    </label>
  );
}
