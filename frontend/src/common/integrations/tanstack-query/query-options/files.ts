import { queryOptions } from "@tanstack/react-query";
import { api } from "@/common/service/api";
import type { AttachmentTarget } from "@/common/types/files";
import { queryKeys } from "../query-keys";

/** Files still being scanned turn available on their own, so listings with them poll. */
const pollWhileScanning = (
  items: { file: { status: string } | null }[] | undefined,
) =>
  items?.some(
    (item) =>
      item.file?.status === "pending" || item.file?.status === "scanning",
  )
    ? 3000
    : false;

export const getDriveQueryOptions = (classId: string, folderId?: string) =>
  queryOptions({
    queryKey: queryKeys.files.drive(classId, folderId),
    queryFn: ({ signal }) =>
      api.files
        .drive(classId, folderId, { signal })
        .then((response) => response.data),
    refetchInterval: (query) => pollWhileScanning(query.state.data?.items),
  });

export const getAttachmentsQueryOptions = (
  targetType: AttachmentTarget,
  targetId: string,
) =>
  queryOptions({
    queryKey: queryKeys.files.attachments(targetType, targetId),
    queryFn: ({ signal }) =>
      api.files
        .attachments(targetType, targetId, { signal })
        .then((response) => response.data),
  });

export const getStudentFilesQueryOptions = (studentId: string) =>
  queryOptions({
    queryKey: queryKeys.files.studentFiles(studentId),
    queryFn: ({ signal }) =>
      api.files
        .studentFiles(studentId, { signal })
        .then((response) => response.data),
    refetchInterval: (query) => pollWhileScanning(query.state.data),
  });

export const getStorageUsageQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.files.usage(),
    queryFn: ({ signal }) =>
      api.files.usage({ signal }).then((response) => response.data),
  });
