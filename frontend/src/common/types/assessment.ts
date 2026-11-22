import type { SchoolClass } from "./academics";
import type { StudentSummary } from "./people";

export const SCALE_KINDS = [
  "points",
  "percentage",
  "letter",
  "levels",
  "standards",
  "pass_fail",
  "custom",
] as const;
export type ScaleKind = (typeof SCALE_KINDS)[number];
export const NUMERIC_SCALE_KINDS: ScaleKind[] = ["points", "percentage"];

export interface ScaleLevel {
  code: string;
  label?: string;
  minMastery: number;
}

export interface ScaleDefinition {
  kind: ScaleKind;
  maxPoints?: number;
  decimals?: number;
  levels?: ScaleLevel[];
}

export interface GradingScale {
  id: string;
  name: string;
  kind: ScaleKind;
  version: number;
  definition: ScaleDefinition;
}

export interface ScalePreset {
  key: string;
  name: string;
  definition: ScaleDefinition;
}

export interface Conversion {
  id: string;
  fromScaleId: string;
  toScaleId: string;
  mapping: Record<string, string>;
  effectiveFrom: string;
}

export const AGGREGATION_METHODS = [
  "weighted_average",
  "most_recent",
  "highest",
  "mode",
] as const;
export type AggregationMethod = (typeof AGGREGATION_METHODS)[number];

export interface GradingPolicy {
  id: string | null;
  subjectId: string | null;
  reportingScaleId: string | null;
  method: AggregationMethod;
  categories: { id: string; name: string; weight: number }[];
}

export type AssessmentKind = "formative" | "summative";

export interface ScaleRef {
  id: string;
  name: string;
  version: number;
  definition: ScaleDefinition;
}

export interface Assessment {
  id: string;
  classId: string;
  title: string;
  description: string | null;
  kind: AssessmentKind;
  dueOn: string | null;
  categoryId: string | null;
  weight: number;
  scale: ScaleRef;
  criteria: { id: string; name: string; weight: number; scale: ScaleRef }[];
  standardIds: string[];
}

export interface AssessmentInput {
  title: string;
  description?: string | null;
  kind: AssessmentKind;
  dueOn?: string | null;
  scaleId: string;
  categoryId?: string | null;
  criteria?: { name: string; scaleId: string; weight?: number }[];
  standardIds?: string[];
}

export interface Grade {
  studentId: string;
  value: string | null;
  mastery: number | null;
  criterionValues: Record<string, string>;
  comment: string | null;
  excused: boolean;
  status: "draft" | "published";
  publishedAt: string | null;
}

export interface GradeEntry {
  studentId: string;
  value?: string | null;
  criterionValues?: Record<string, string>;
  comment?: string | null;
  excused?: boolean;
}

export interface GradingSheet {
  assessment: Assessment;
  students: StudentSummary[];
  grades: Grade[];
  submissions: {
    studentId: string;
    body: string | null;
    fileId: string | null;
    submittedAt: string;
    isLate: boolean;
  }[];
  canPublish: boolean;
}

export interface Gradebook {
  class: SchoolClass;
  term: { id: string; name: string; startsOn: string; endsOn: string } | null;
  method: AggregationMethod;
  reportingScale: GradingScale | null;
  categories: GradingPolicy["categories"];
  assessments: (Pick<
    Assessment,
    "id" | "title" | "kind" | "dueOn" | "categoryId" | "weight"
  > & {
    scale: { id: string; name: string; kind: ScaleKind };
  })[];
  students: StudentSummary[];
  grades: (Grade & { assessmentId: string })[];
  results: {
    studentId: string;
    mastery: number | null;
    value: string | null;
  }[];
}

export interface StudentClassGrades {
  class: Pick<SchoolClass, "id" | "code" | "name" | "subject">;
  reportingScale: { id: string; name: string } | null;
  result: { mastery: number | null; value: string | null };
  assessments: {
    id: string;
    title: string;
    description: string | null;
    kind: AssessmentKind;
    dueOn: string | null;
    scale: { id: string; name: string };
    grade: {
      value: string | null;
      reported: string | null;
      comment: string | null;
      excused: boolean;
      publishedAt: string;
    } | null;
    submission: {
      body: string | null;
      fileId: string | null;
      submittedAt: string;
      isLate: boolean;
    } | null;
  }[];
}
