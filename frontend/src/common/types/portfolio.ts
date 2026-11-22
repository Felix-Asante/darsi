import type { StudentClassGrades } from "./assessment";
import type { Lesson } from "./calendar";
import type { StoredFile, StudentFileEntry } from "./files";
import type { StudentSummary } from "./people";
import type { RichTextNode } from "./rich-text";

export type ItemKind = "image" | "document" | "link" | "text";

export interface PortfolioItem {
  id: string;
  studentId: string | null;
  classId: string | null;
  kind: ItemKind;
  title: string;
  description: string | null;
  url: string | null;
  body: RichTextNode | null;
  file: StoredFile | null;
  tags: string[];
  status: "pending" | "approved";
  addedBy: { id: string; name: string } | null;
  createdAt: string;
  comments: {
    id: string;
    kind: "comment" | "reflection";
    body: string;
    author: { id: string; name: string } | null;
    createdAt: string;
  }[];
  canApprove: boolean;
  canDelete: boolean;
}

export interface PortfolioItemInput {
  studentId?: string | null;
  classId?: string | null;
  kind: ItemKind;
  title: string;
  description?: string | null;
  url?: string | null;
  body?: RichTextNode | null;
  fileId?: string | null;
  tags?: string[];
}

export interface PortfolioOverview {
  student: StudentSummary;
  term: { id: string; name: string; startsOn: string; endsOn: string } | null;
  week: { from: string; to: string; lessons: Lesson[] };
  items: PortfolioItem[];
  attendance: {
    rate: number | null;
    sessions: number;
    absent: number;
    late: number;
    excused: number;
  } | null;
  grades: {
    class: StudentClassGrades["class"];
    result: StudentClassGrades["result"];
    reportingScale: StudentClassGrades["reportingScale"];
    latest: { title: string; value: string | null; scale: string } | null;
  }[];
  reports: {
    id: string;
    term: string;
    fileId: string | null;
    publishedAt: string;
  }[];
  files: StudentFileEntry[];
}

export type ReportStatus = "draft" | "returned" | "approved" | "published";

export interface ReportTemplate {
  id: string;
  divisionId: string | null;
  name: string;
  subjectIds: string[];
  includeAttendance: boolean;
  includeGeneralComment: boolean;
}

export interface ReportClassSheet {
  reportingScale: { id: string; name: string } | null;
  rows: {
    student: StudentSummary;
    status: ReportStatus;
    returnNote: string | null;
    result: string | null;
    comment: string | null;
  }[];
}

export interface ReportCardSummary {
  id: string;
  status: ReportStatus;
  student: StudentSummary;
  entries: number;
  commented: number;
  fileId: string | null;
}

export interface ReportCardDetail {
  id: string;
  status: ReportStatus;
  locale: "en" | "fr";
  generalComment: string | null;
  returnNote: string | null;
  attendance: {
    rate: number | null;
    sessions: number;
    absent: number;
    late: number;
  } | null;
  fileId: string | null;
  publishedAt: string | null;
  term: { id: string; name: string; startsOn: string; endsOn: string };
  student: StudentSummary;
  entries: {
    id: string;
    classId: string;
    subjectName: string | null;
    resultValue: string | null;
    reportingScaleName: string | null;
    comment: string | null;
  }[];
}
