"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useCurrentSchool, useHasRole } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { getStudentFilesQueryOptions } from "@/common/integrations/tanstack-query/query-options/files";
import { formatDate } from "@/common/lib/format";
import { api } from "@/common/service/api";
import { FileOpener, FileStatusNote } from "@/components/files/file-opener";
import { UploadButton } from "@/components/files/upload-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** Official documents on the student's record; families see only what was shared with them (RPT-7). */
export function StudentFiles({ studentId }: Readonly<{ studentId: string }>) {
  const t = useTranslations("files.student");
  const locale = useLocale();
  const school = useCurrentSchool();
  const errorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const canManage = useHasRole("admin");
  const files = useQuery(getStudentFilesQueryOptions(studentId));
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.files.studentFiles(studentId),
    });
  const share = useMutation({
    mutationFn: ({
      id,
      visibleToFamily,
    }: {
      id: string;
      visibleToFamily: boolean;
    }) => api.files.updateStudentFile(id, { visibleToFamily }),
    onSuccess: refresh,
    onError: (error) => toast.error(errorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.files.removeStudentFile(id),
    onSuccess: refresh,
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <section
      aria-labelledby="student-files-title"
      className="bg-card flex flex-col gap-3 rounded-lg border p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <h2
            id="student-files-title"
            className="text-base font-semibold tracking-tight"
          >
            {t("title")}
          </h2>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>
        {canManage && (
          <UploadButton
            variant="outline"
            label={t("upload")}
            target={{ type: "student", studentId }}
            onUploaded={refresh}
          />
        )}
      </div>
      {files.data?.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      ) : (
        <ul className="divide-y">
          {(files.data ?? []).map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 first:pt-0 last:pb-0"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{entry.title}</span>
                <span className="text-muted-foreground text-xs">
                  {formatDate(entry.createdAt, locale, school.timeZone)}
                </span>
                <FileStatusNote file={entry.file} />
              </span>
              {canManage && (
                <>
                  <Badge variant={entry.visibleToFamily ? "info" : "outline"}>
                    {entry.visibleToFamily ? t("family") : t("staffOnly")}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={share.isPending}
                    onClick={() =>
                      share.mutate({
                        id: entry.id,
                        visibleToFamily: !entry.visibleToFamily,
                      })
                    }
                  >
                    {entry.visibleToFamily ? t("unshare") : t("share")}
                  </Button>
                </>
              )}
              <FileOpener file={entry.file} />
              {canManage && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("delete", { title: entry.title })}
                  onClick={() => remove.mutate(entry.id)}
                >
                  <Trash2Icon aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
