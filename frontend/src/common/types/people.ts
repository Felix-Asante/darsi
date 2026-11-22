import type { SchoolClass } from "./academics";

export type StudentStatus = "active" | "withdrawn";

export interface StudentSummary {
  id: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  status: StudentStatus;
  gradeLevel: { id: string; name: string } | null;
}

export const RELATIONSHIPS = [
  "mother",
  "father",
  "parent",
  "guardian",
  "grandparent",
  "other",
] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export interface GuardianSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  preferredLocale: "en" | "fr";
  hasAccount: boolean;
}

export interface StudentProfile extends StudentSummary {
  dateOfBirth: string | null;
  email: string | null;
  enrolledOn: string | null;
  withdrawnOn: string | null;
  withdrawalReason: string | null;
  family: { id: string; name: string } | null;
  guardians: (GuardianSummary & {
    relationship: Relationship;
    isPrimaryContact: boolean;
  })[];
  siblings: StudentSummary[];
  classes: (SchoolClass & { enrolledSince: string })[];
}

export interface StudentInput {
  studentNumber: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  dateOfBirth?: string | null;
  email?: string | null;
  gradeLevelId?: string | null;
}

export interface GuardianInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  preferredLocale?: "en" | "fr";
}

export interface StudentListQuery {
  search?: string;
  gradeLevelId?: string;
  status?: StudentStatus;
  cursor?: string;
  limit?: number;
  [key: string]: string | number | undefined;
}

export const IMPORT_KINDS = [
  "students",
  "guardians",
  "classes",
  "enrolments",
  "standards",
  "timetable",
] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];
export type ImportStatus = "queued" | "running" | "completed" | "failed";

export interface ImportJob {
  id: string;
  kind: ImportKind;
  status: ImportStatus;
  fileName: string;
  totalRows: number;
  importedRows: number;
  failedRows: number;
  errors: { row: number; field: string | null; code: string }[];
  createdAt: string;
  finishedAt: string | null;
}

export type ImportColumns = Record<
  ImportKind,
  { required: string[]; optional: string[] }
>;
