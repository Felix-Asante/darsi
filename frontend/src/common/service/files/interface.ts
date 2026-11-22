import type { ApiResponse } from "@/common/types/api";
import type {
  AttachmentTarget,
  Download,
  DriveAudience,
  DriveItem,
  DriveListing,
  StoredFile,
  StudentFileEntry,
  UploadTarget,
} from "@/common/types/files";
import type { RequestConfig } from "../http.service";

export interface IFilesService {
  /** Sends the file straight to storage, then asks the API to scan it. */
  upload: (file: File, target: UploadTarget) => Promise<StoredFile>;
  download: (id: string, inline?: boolean) => ApiResponse<Download>;
  usage: (
    config?: RequestConfig,
  ) => ApiResponse<{ usedBytes: number; quotaBytes: number }>;
  drive: (
    classId: string,
    folderId?: string,
    config?: RequestConfig,
  ) => ApiResponse<DriveListing>;
  createFolder: (
    classId: string,
    input: {
      name: string;
      parentId?: string | null;
      visibility?: DriveAudience[];
    },
  ) => ApiResponse<DriveItem>;
  updateItem: (
    id: string,
    input: {
      name?: string;
      parentId?: string | null;
      visibility?: DriveAudience[];
    },
  ) => ApiResponse<DriveItem>;
  removeItem: (id: string) => ApiResponse<void>;
  attachments: (
    targetType: AttachmentTarget,
    targetId: string,
    config?: RequestConfig,
  ) => ApiResponse<DriveItem[]>;
  setAttachments: (
    targetType: AttachmentTarget,
    targetId: string,
    driveItemIds: string[],
  ) => ApiResponse<DriveItem[]>;
  studentFiles: (
    studentId: string,
    config?: RequestConfig,
  ) => ApiResponse<StudentFileEntry[]>;
  updateStudentFile: (
    id: string,
    input: { title?: string; visibleToFamily?: boolean },
  ) => ApiResponse<void>;
  removeStudentFile: (id: string) => ApiResponse<void>;
}
