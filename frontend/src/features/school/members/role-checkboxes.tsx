"use client";

import { useTranslations } from "next-intl";
import type { Role } from "@/common/auth/roles";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";

/** Roles given by invitation. Applicant families come in through admissions instead. */
export const ASSIGNABLE_ROLES: Role[] = [
  "admin",
  "coordinator",
  "teacher",
  "teaching_assistant",
  "class_member",
  "admissions_officer",
  "finance_officer",
  "guardian",
  "student",
];

interface RoleCheckboxesProps {
  legend: string;
  value: Role[];
  onChange: (roles: Role[]) => void;
  error?: string;
}

export function RoleCheckboxes({ legend, value, onChange, error }: Readonly<RoleCheckboxesProps>) {
  const tRoles = useTranslations("roles");

  return (
    <FieldSet data-invalid={error ? true : undefined}>
      <FieldLegend variant="label">{legend}</FieldLegend>
      <div className="grid gap-2 sm:grid-cols-2">
        {ASSIGNABLE_ROLES.map((role) => {
          const id = `role-${role}`;
          return (
            <Field key={role} orientation="horizontal">
              <Checkbox
                id={id}
                checked={value.includes(role)}
                onCheckedChange={(checked) =>
                  onChange(checked ? [...value, role] : value.filter((existing) => existing !== role))
                }
              />
              <FieldLabel htmlFor={id} className="font-normal">
                {tRoles(role)}
              </FieldLabel>
            </Field>
          );
        })}
      </div>
      {error && <FieldError>{error}</FieldError>}
    </FieldSet>
  );
}
