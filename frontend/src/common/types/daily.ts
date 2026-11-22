import type { SchoolClass } from "./academics";
import type { StudentSummary } from "./people";
import type { RichTextNode } from "./rich-text";

export type AttendanceMode = "daily" | "period";
export const COUNTS_AS = ["present", "absent", "late", "excused"] as const;
export type CountsAs = (typeof COUNTS_AS)[number];

export interface AttendanceStatus {
  code: string;
  /** Null for the four built-in statuses, which the app translates. */
  label: string | null;
  countsAs: CountsAs;
}

export interface AttendanceSettings {
  mode: AttendanceMode;
  notifyAfterMinutes: number;
}

export interface AttendanceSheet {
  mode: AttendanceMode;
  date: string;
  periodId: string | null;
  dayOff: boolean;
  closed: boolean;
  taken: { at: string; by: string | null } | null;
  statuses: AttendanceStatus[];
  students: {
    student: StudentSummary;
    status: string;
    reason: string | null;
    reasonSource: "staff" | "guardian" | null;
  }[];
}

export interface AttendanceSummary {
  sessions: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  rate: number | null;
}

export interface StudentAttendance extends AttendanceSummary {
  exceptions: {
    date: string;
    classId: string;
    status: string;
    reason: string | null;
  }[];
}

export type ReportLine = AttendanceSummary & { student: StudentSummary };

export type AnnouncementAudience =
  "school" | "division" | "grade_level" | "class" | "role";

export interface Announcement {
  id: string;
  title: string;
  body: RichTextNode;
  audience: AnnouncementAudience;
  audienceId: string | null;
  audienceRole: string | null;
  audienceName: string | null;
  author: { id: string; name: string } | null;
  publishAt: string;
  publishedAt: string | null;
  canDelete: boolean;
}

export interface AnnouncementInput {
  title: string;
  body: RichTextNode;
  audience: AnnouncementAudience;
  audienceId?: string | null;
  audienceRole?: string | null;
  /** School-local `YYYY-MM-DDTHH:mm`; leave out to send now. */
  publishAt?: string | null;
}

export interface TemplateField {
  key: string;
  label: string;
  kind: "text" | "richtext";
}

export interface PlanTemplate {
  id: string;
  name: string;
  frameworkId: string | null;
  fields: TemplateField[];
}

export interface UnitSummary {
  id: string;
  title: string;
  startsOn: string | null;
  endsOn: string | null;
  classes: Pick<SchoolClass, "id" | "code" | "name">[];
  lessonCount: number;
}

export interface LessonPlan {
  id: string;
  title: string;
  date: string | null;
  objectives: RichTextNode | null;
  activities: RichTextNode | null;
  resources: RichTextNode | null;
  sortOrder: number;
  updatedAt: string;
  updatedBy: { id: string; name: string } | null;
}

export interface UnitPlan {
  id: string;
  title: string;
  templateId: string | null;
  startsOn: string | null;
  endsOn: string | null;
  objectives: RichTextNode | null;
  fieldValues: Record<string, string | RichTextNode>;
  updatedAt: string;
  access: "owner" | "editor" | "viewer";
  createdBy: { id: string; name: string } | null;
  updatedBy: { id: string; name: string } | null;
  classes: SchoolClass[];
  standardIds: string[];
  assessmentIds: string[];
  collaborators: { userId: string; role: "editor" | "viewer"; name: string }[];
  lessons: LessonPlan[];
}

export interface UnitInput {
  title: string;
  templateId?: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
  objectives?: RichTextNode | null;
  fieldValues?: Record<string, string | RichTextNode>;
  classIds: string[];
  standardIds?: string[];
}

export interface LessonInput {
  title: string;
  date?: string | null;
  objectives?: RichTextNode | null;
  activities?: RichTextNode | null;
  resources?: RichTextNode | null;
}

export type NotificationPreferenceType =
  "announcement.published" | "attendance.absence" | "grade.published";

export interface NotificationPreference {
  type: NotificationPreferenceType;
  inApp: boolean;
  email: boolean;
}
