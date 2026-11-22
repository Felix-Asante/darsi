"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PaperclipIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { getAttachmentsQueryOptions, getDriveQueryOptions } from "@/common/integrations/tanstack-query/query-options/files";
import { api } from "@/common/service/api";
import type { AttachmentTarget } from "@/common/types/files";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** Attaches files from the top of the class drive by reference (DRV-10). */
export function AttachmentPicker({
  classId,
  targetType,
  targetId,
}: Readonly<{ classId: string; targetType: AttachmentTarget; targetId: string }>) {
  const t = useTranslations("files.attachments");
  const tCommon = useTranslations("common");
  const errorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const drive = useQuery({ ...getDriveQueryOptions(classId), enabled: open });
  const current = useQuery(getAttachmentsQueryOptions(targetType, targetId));
  const [chosen, setChosen] = useState<string[] | null>(null);
  const selected = chosen ?? current.data?.map((item) => item.id) ?? [];
  const files = (drive.data?.items ?? []).filter((item) => item.kind === "file" && item.file?.status === "available");
  const save = useMutation({
    mutationFn: () => api.files.setAttachments(targetType, targetId, selected),
    onSuccess: async () => {
      toast.success(t("saved"));
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.files.attachments(targetType, targetId) });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setChosen(null);
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <PaperclipIcon aria-hidden />
        {t("choose")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("choose")}</DialogTitle>
        </DialogHeader>
        {drive.isSuccess && files.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("none")}</p>
        ) : (
          <fieldset className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            <legend className="sr-only">{t("title")}</legend>
            {files.map((item) => (
              <label key={item.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selected.includes(item.id)}
                  onCheckedChange={(checked) =>
                    setChosen(checked === true ? [...selected, item.id] : selected.filter((id) => id !== item.id))
                  }
                />
                {item.name}
              </label>
            ))}
          </fieldset>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            {tCommon("cancel")}
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
