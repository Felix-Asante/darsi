export const ROLES = [
  "admin",
  "admissions_officer",
  "finance_officer",
  "coordinator",
  "teacher",
  "teaching_assistant",
  "class_member",
  "student",
  "guardian",
  "applicant",
] as const;

export type Role = (typeof ROLES)[number];

const isRole = (value: string): value is Role =>
  (ROLES as readonly string[]).includes(value);

/** Better Auth stores several roles as one comma-separated string. */
export function parseRoleList(stored: string | null | undefined): Role[] {
  return (stored ?? "")
    .split(",")
    .map((role) => role.trim())
    .filter(isRole);
}
