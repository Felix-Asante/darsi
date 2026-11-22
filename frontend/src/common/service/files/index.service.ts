import type { StoredFile } from "@/common/types/files";
import { createApiError } from "@/common/utils/errors";
import { apiEndpoints } from "../api/end-points";
import type { HttpClient } from "../http.service";
import type { IFilesService } from "./interface";

export function createFilesService(http: HttpClient): IFilesService {
  const { files, drive } = apiEndpoints;
  return {
    upload: async (file, target) => {
      const contentType = file.type || "application/octet-stream";
      const { data: session } = await http.post<{
        file: { id: string };
        uploadUrl: string;
      }>(files.uploads(), {
        name: file.name,
        contentType,
        size: file.size,
        target,
      });
      // Straight to storage: the presigned URL carries the permission, so no cookies are sent.
      const response = await fetch(session.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "content-type": contentType },
      });
      if (!response.ok)
        throw createApiError({
          code: "upload_failed",
          status: response.status,
        });
      return (await http.post<StoredFile>(files.complete(session.file.id)))
        .data;
    },
    download: (id, inline) => http.get(files.download(id, inline)),
    usage: (config) => http.get(files.usage(), undefined, config),
    drive: (classId, folderId, config) =>
      http.get(drive.list(classId, folderId), undefined, config),
    createFolder: (classId, input) => http.post(drive.folders(classId), input),
    updateItem: (id, input) => http.patch(drive.item(id), input),
    removeItem: (id) => http.delete(drive.item(id)),
    attachments: (targetType, targetId, config) =>
      http.get(drive.attachments({ targetType, targetId }), undefined, config),
    setAttachments: (targetType, targetId, driveItemIds) =>
      http.put(drive.attachments(), { targetType, targetId, driveItemIds }),
    studentFiles: (studentId, config) =>
      http.get(files.studentFiles(studentId), undefined, config),
    updateStudentFile: (id, input) => http.patch(files.studentFile(id), input),
    removeStudentFile: (id) => http.delete(files.studentFile(id)),
  };
}
