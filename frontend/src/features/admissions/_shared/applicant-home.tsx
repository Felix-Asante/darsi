"use client";

import { type ReactNode, useEffect } from "react";
import { useMe } from "@/common/auth/me-context";
import { useRouter } from "@/common/i18n/navigation";

/** A family that has only applied so far has nothing on the school's Today page; their home is their applications. */
export function ApplicantHome({ children }: Readonly<{ children: ReactNode }>) {
  const { roles } = useMe().currentSchool;
  const applicantOnly = roles.length === 1 && roles[0] === "applicant";
  const router = useRouter();
  useEffect(() => {
    if (applicantOnly) router.replace("/applications");
  }, [applicantOnly, router]);
  return applicantOnly ? null : children;
}
