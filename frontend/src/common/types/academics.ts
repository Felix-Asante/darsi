export interface AcademicYear {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
}

export interface GradeLevel {
  id: string;
  divisionId: string;
  name: string;
  sortOrder: number;
}

export interface Division {
  id: string;
  name: string;
  sortOrder: number;
  gradeLevels: GradeLevel[];
}

export interface Subject {
  id: string;
  code: string;
  name: string;
}

export const CLASS_STAFF_ROLES = [
  "teacher",
  "teaching_assistant",
  "class_member",
] as const;
export type ClassStaffRole = (typeof CLASS_STAFF_ROLES)[number];

export interface ClassStaffMember {
  userId: string;
  role: ClassStaffRole;
  name: string;
  email: string;
}

export interface SchoolClass {
  id: string;
  code: string;
  name: string;
  academicYearId: string;
  gradeLevel: { id: string; name: string } | null;
  subject: { id: string; code: string; name: string } | null;
  staff: ClassStaffMember[];
}

export interface AcademicYearInput {
  name: string;
  startsOn: string;
  endsOn: string;
}

export interface ClassInput {
  academicYearId: string;
  code: string;
  name: string;
  gradeLevelId?: string | null;
  subjectId?: string | null;
}

export interface Framework {
  id: string;
  code: string;
  name: string;
  description: string | null;
  standardCount: number;
}

export interface StandardNode {
  id: string;
  code: string;
  description: string;
  children: StandardNode[];
}
