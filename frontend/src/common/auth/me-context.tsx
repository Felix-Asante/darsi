"use client";

import { createContext, useContext } from "react";
import type { Role } from "@/common/auth/roles";
import type { Me, School } from "@/common/types/identity";

type SignedIn = Me & { currentSchool: School & { roles: Role[] } };

const MeContext = createContext<SignedIn | null>(null);

export const MeProvider = MeContext.Provider;

/** The signed-in user in the current school. Only available under the session gate. */
export function useMe(): SignedIn {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe() must be used inside the session gate");
  return me;
}

export function useCurrentSchool() {
  return useMe().currentSchool;
}

export function useHasRole(...roles: Role[]): boolean {
  return useMe().currentSchool.roles.some((role) => roles.includes(role));
}
