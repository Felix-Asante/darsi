"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, FileIcon, FolderIcon, FolderPlusIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { Link } from "@/common/i18n/navigation";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { getClassQueryOptions } from "@/common/integrations/tanstack-query/query-options/academics";
import { getDriveQueryOptions } from "@/common/integrations/tanstack-query/query-options/files";
import { formatBytes } from "@/common/lib/format";
import { api } from "@/common/service/api";
import type { DriveItem } from "@/common/types/files";
import { FileOpener, FileStatusNote } from "@/components/files/file-opener";
import { UploadButton } from "@/components/files/upload-button";
import { FormAlert } from "@/components/form/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EditItemDialog, type ItemChanges } from "./edit-item-dialog";

export function ClassDrive({ classId, folderId }: Readonly<{ classId: string; folderId?: string }>) {
  const t = useTranslations("files.drive");
  const format = useFormatter();
  const locale = useLocale();
  const errorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const schoolClass = useQuery({ ...getClassQueryOptions(classId), retry: false });
  const drive = useQuery(getDriveQueryOptions(classId, folderId));
  const [folderName, setFolderName] = useState("");
  const [editing, setEditing] = useState<DriveItem | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.files.all() });
  const onError = (error: unknown) => toast.error(errorMessage(error));
  const createFolder = useMutation({
    mutationFn: () => api.files.createFolder(classId, { name: folderName.trim(), parentId: folderId ?? null }),
    onSuccess: () => {
      setFolderName("");
      toast.success(t("folderCreated"));
      return refresh();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.files.removeItem(id),
    onSuccess: () => {
      toast.success(t("deleted"));
      return refresh();
    },
    onError,
  });
  const update = (item: DriveItem, changes: ItemChanges) =>
    api.files.updateItem(item.id, changes).then(() => {
      toast.success(t("saved"));
      return refresh();
    }, onError);

  const listing = drive.data;
  const parentFolder = listing && listing.path.length > 1 ? listing.path[listing.path.length - 2] : null;
  const folders = [
    ...(parentFolder ? [parentFolder] : []),
    ...(listing?.items.filter((item) => item.kind === "folder").map(({ id, name }) => ({ id, name })) ?? []),
  ];
  const href = (id?: string) => `/classes/${classId}/drive${id ? `?folder=${id}` : ""}`;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Link href={`/classes/${classId}`} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeftIcon aria-hidden className="size-4" />
        {schoolClass.data?.name ?? t("title")}
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground max-w-prose text-sm">{t("description")}</p>
      </div>

      <nav aria-label={t("title")}>
        <ol className="flex flex-wrap items-center gap-1 text-sm">
          <li>
            <Link href={href()} className="hover:underline" aria-current={!folderId ? "page" : undefined}>
              {t("root")}
            </Link>
          </li>
          {listing?.path.map((folder, index) => (
            <li key={folder.id} className="flex items-center gap-1">
              <span aria-hidden className="text-muted-foreground">
                /
              </span>
              <Link href={href(folder.id)} className="hover:underline" aria-current={index === listing.path.length - 1 ? "page" : undefined}>
                {folder.name}
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      {listing?.access.manage && (
        <div className="flex flex-wrap items-end gap-3">
          <UploadButton target={{ type: "drive", classId, parentId: folderId ?? null }} onUploaded={refresh} />
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (folderName.trim()) createFolder.mutate();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-folder" className="sr-only">
                {t("folderName")}
              </Label>
              <Input id="new-folder" placeholder={t("folderName")} value={folderName} onChange={(event) => setFolderName(event.target.value)} />
            </div>
            <Button type="submit" variant="outline" size="sm" disabled={!folderName.trim() || createFolder.isPending}>
              <FolderPlusIcon aria-hidden />
              {t("newFolder")}
            </Button>
          </form>
        </div>
      )}

      <FormAlert message={drive.error ? errorMessage(drive.error) : null} />
      {drive.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : listing && listing.items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      ) : (
        <ul className="bg-card divide-y rounded-lg border">
          {listing?.items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
              {item.kind === "folder" ? (
                <FolderIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />
              ) : (
                <FileIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                {item.kind === "folder" ? (
                  <Link href={href(item.id)} className="truncate font-medium hover:underline">
                    {item.name}
                  </Link>
                ) : (
                  <span className="truncate font-medium">{item.name}</span>
                )}
                {item.file && <FileStatusNote file={item.file} />}
              </span>
              {listing.access.manage && (
                <span className="flex flex-wrap gap-1">
                  {item.visibility.length === 0 ? (
                    <Badge variant="outline">{t("staffOnly")}</Badge>
                  ) : (
                    item.visibility.map((audience) => (
                      <Badge key={audience} variant="secondary">
                        {t(`audiences.${audience}`)}
                      </Badge>
                    ))
                  )}
                </span>
              )}
              {item.file && (
                <span className="text-muted-foreground w-20 text-end text-sm tabular-nums">{formatBytes(item.file.sizeBytes, locale)}</span>
              )}
              <span className="text-muted-foreground hidden w-28 text-sm sm:inline">{format.relativeTime(new Date(item.updatedAt))}</span>
              <span className="flex">
                {item.file && <FileOpener file={item.file} />}
                {listing.access.manage && (
                  <Button variant="ghost" size="icon-sm" aria-label={t("edit", { name: item.name })} onClick={() => setEditing(item)}>
                    <PencilIcon aria-hidden />
                  </Button>
                )}
                {listing.access.delete && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("delete", { name: item.name })}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(item.id)}
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <EditItemDialog
        key={editing?.id ?? "none"}
        item={editing}
        folders={folders}
        onClose={() => setEditing(null)}
        onSave={(changes) => update(editing!, changes)}
      />
    </div>
  );
}
