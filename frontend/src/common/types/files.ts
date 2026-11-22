export type FileStatus = "pending" | "scanning" | "available" | "rejected";
export type PreviewKind = "image" | "pdf" | "video" | "audio" | "text" | null;

export interface StoredFile {
  id: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  status: FileStatus;
  preview: PreviewKind;
}

export const DRIVE_AUDIENCES = ["class_member", "student", "guardian"] as const;
export type DriveAudience = (typeof DRIVE_AUDIENCES)[number];

export interface DriveItem {
  id: string;
  classId: string;
  parentId: string | null;
  kind: "folder" | "file";
  name: string;
  visibility: DriveAudience[];
  file: StoredFile | null;
  updatedAt: string;
}

export interface DriveListing {
  access: { manage: boolean; delete: boolean };
  path: { id: string; name: string }[];
  items: DriveItem[];
}

export type UploadTarget =
  | {
      type: "drive";
      classId: string;
      parentId?: string | null;
      visibility?: DriveAudience[];
    }
  | {
      type: "student";
      studentId: string;
      title?: string;
      visibleToFamily?: boolean;
    }
  | { type: "submission"; assessmentId: string }
  | { type: "portfolio"; studentId?: string; classId?: string }
  | { type: "application"; applicationId: string };

export type AttachmentTarget = "lesson" | "assessment" | "announcement";

export interface StudentFileEntry {
  id: string;
  title: string;
  visibleToFamily: boolean;
  createdAt: string;
  file: StoredFile;
}

export interface Download extends StoredFile {
  url: string;
}
