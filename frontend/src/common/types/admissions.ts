import type { StoredFile } from "./files";

export type StageKind =
  | "enquiry"
  | "submitted"
  | "review"
  | "interview"
  | "offered"
  | "accepted"
  | "enrolled"
  | "waitlisted"
  | "declined"
  | "withdrawn";

export const STAGE_KINDS: StageKind[] = [
  "enquiry",
  "submitted",
  "review",
  "interview",
  "offered",
  "accepted",
  "enrolled",
  "waitlisted",
  "declined",
  "withdrawn",
];

export type Relationship =
  "mother" | "father" | "parent" | "guardian" | "grandparent" | "other";
export const RELATIONSHIPS: Relationship[] = [
  "mother",
  "father",
  "parent",
  "guardian",
  "grandparent",
  "other",
];

export interface Label {
  en: string;
  fr?: string;
}

export type FieldType = "text" | "textarea" | "date" | "select" | "checkbox";

export interface FormField {
  key: string;
  label: Label;
  type: FieldType;
  required: boolean;
  options?: string[];
}

export interface FormDocument {
  key: string;
  label: Label;
  required: boolean;
}

export interface AdmissionForm {
  id: string;
  divisionId: string | null;
  fields: FormField[];
  documents: FormDocument[];
}

export interface StageEmail {
  en: { subject: string; body: string };
  fr?: { subject: string; body: string };
}

export interface Stage {
  id: string;
  name: string;
  kind: StageKind;
  sortOrder: number;
  email: StageEmail | null;
}

export interface Cycle {
  id: string;
  academicYearId: string;
  name: string;
  opensOn: string;
  closesOn: string;
  grades: { gradeLevelId: string; places: number }[];
  applicationFee: string;
  depositFeeItemId: string | null;
}

export interface PublicAdmissions {
  school: {
    name: string;
    logo: string | null;
    defaultLocale: string;
    currency: string;
  };
  cycles: {
    id: string;
    name: string;
    closesOn: string;
    applicationFee: string;
    grades: { id: string; name: string }[];
  }[];
}

export interface ApplicationInput {
  cycleId: string;
  gradeLevelId: string;
  studentFirstName?: string | null;
  studentLastName?: string | null;
  studentPreferredName?: string | null;
  studentDateOfBirth?: string | null;
  guardianFirstName?: string | null;
  guardianLastName?: string | null;
  guardianPhone?: string | null;
  guardianRelationship?: Relationship | null;
  answers?: Record<string, string | boolean>;
}

/** What the family sees. Staff notes are never part of it. */
export interface FamilyApplication {
  id: string;
  status: "draft" | "submitted";
  cycle: { id: string; name: string; applicationFee: string };
  gradeLevel: { id: string; name: string };
  stage: Stage | null;
  student: {
    firstName: string | null;
    lastName: string | null;
    preferredName: string | null;
    dateOfBirth: string | null;
  };
  guardian: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    relationship: Relationship | null;
  };
  answers: Record<string, string | boolean>;
  form: { fields: FormField[]; documents: FormDocument[] };
  documents: { key: string; file: StoredFile }[];
  submittedAt: string | null;
  feeInvoiceId: string | null;
  offer: {
    expiresOn: string | null;
    response: "accepted" | "declined" | null;
  } | null;
}

export interface StaffApplication extends FamilyApplication {
  guardianEmail: string;
  familyId: string | null;
  studentId: string | null;
  notes: {
    id: string;
    kind: "note" | "rating" | "interview";
    body: string;
    rating: number | null;
    author: string;
    createdAt: string;
  }[];
}

export interface ApplicationSummary {
  id: string;
  cycleId: string;
  gradeLevel: { id: string; name: string };
  stageId: string | null;
  student: {
    firstName: string | null;
    lastName: string | null;
    dateOfBirth: string | null;
  };
  guardian: { name: string; email: string };
  submittedAt: string;
  offerExpiresOn: string | null;
  offerResponse: "accepted" | "declined" | null;
  studentId: string | null;
  notes: number;
  rating: number | null;
}

export interface ReEnrolmentEntry {
  id: string;
  academicYearId: string;
  student: {
    id: string;
    name: string;
    gradeLevel: { id: string; name: string } | null;
  } | null;
  nextGradeLevel: { id: string; name: string } | null;
  status: "pending" | "confirmed" | "declined" | "applied";
  respondedAt: string | null;
}
