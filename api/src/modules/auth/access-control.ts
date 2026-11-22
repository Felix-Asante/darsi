import { createAccessControl } from 'better-auth/plugins/access';
import {
  adminAc,
  defaultStatements,
} from 'better-auth/plugins/organization/access';

/**
 * What each role may do in a school. "Own" and "assigned" scopes (a guardian's
 * own children, a teacher's own classes) are checked by PolicyService on top.
 */
export const statement = {
  ...defaultStatements,
  school: ['read', 'manage'],
  academics: ['read', 'manage'],
  people: ['read', 'manage'],
  gradingScale: ['read', 'manage'],
  assessment: ['read', 'create', 'grade', 'publish'],
  plan: ['read', 'write'],
  portfolio: ['read', 'write', 'approve'],
  attendance: ['read', 'take', 'edit-closed'],
  drive: ['read', 'upload', 'delete'],
  announcement: ['read', 'post-class', 'post-school'],
  calendar: ['read', 'manage'],
  timetable: ['read', 'manage'],
  report: ['read', 'comment', 'approve', 'manage'],
  application: ['read', 'submit', 'manage', 'decide'],
  fee: ['read', 'manage'],
  invoice: ['read', 'issue', 'credit'],
  payment: ['read', 'record', 'refund'],
  riskFlag: ['read', 'action'],
} as const;

export const ac = createAccessControl(statement);

export type Permissions = {
  [Resource in keyof typeof statement]?: (typeof statement)[Resource][number][];
};

const communityRead = {
  announcement: ['read'],
  calendar: ['read'],
  timetable: ['read'],
} as const;

export const roles = {
  admin: ac.newRole({
    ...adminAc.statements,
    school: ['read', 'manage'],
    academics: ['read', 'manage'],
    people: ['read', 'manage'],
    gradingScale: ['read', 'manage'],
    assessment: ['read'],
    plan: ['read'],
    portfolio: ['read'],
    attendance: ['read', 'take', 'edit-closed'],
    drive: ['read'],
    announcement: ['read', 'post-class', 'post-school'],
    calendar: ['read', 'manage'],
    timetable: ['read', 'manage'],
    report: ['read', 'manage'],
    application: ['read'],
    fee: ['read'],
    invoice: ['read'],
    payment: ['read'],
    riskFlag: ['read'],
  }),
  admissions_officer: ac.newRole({
    ...communityRead,
    announcement: ['read', 'post-school'],
    people: ['read'],
    application: ['read', 'manage', 'decide'],
  }),
  finance_officer: ac.newRole({
    ...communityRead,
    announcement: ['read', 'post-school'],
    people: ['read'],
    application: ['read'],
    fee: ['read', 'manage'],
    invoice: ['read', 'issue', 'credit'],
    payment: ['read', 'record', 'refund'],
  }),
  coordinator: ac.newRole({
    ...communityRead,
    announcement: ['read', 'post-school'],
    calendar: ['read', 'manage'],
    school: ['read'],
    academics: ['read'],
    people: ['read'],
    gradingScale: ['read'],
    assessment: ['read'],
    plan: ['read'],
    portfolio: ['read'],
    attendance: ['read'],
    drive: ['read'],
    report: ['read', 'approve'],
    application: ['read'],
    riskFlag: ['read'],
  }),
  teacher: ac.newRole({
    ...communityRead,
    announcement: ['read', 'post-class'],
    school: ['read'],
    academics: ['read'],
    people: ['read'],
    gradingScale: ['read'],
    assessment: ['read', 'create', 'grade', 'publish'],
    plan: ['read', 'write'],
    portfolio: ['read', 'write', 'approve'],
    attendance: ['read', 'take'],
    drive: ['read', 'upload', 'delete'],
    report: ['read', 'comment'],
    riskFlag: ['read', 'action'],
  }),
  teaching_assistant: ac.newRole({
    ...communityRead,
    school: ['read'],
    academics: ['read'],
    people: ['read'],
    gradingScale: ['read'],
    assessment: ['read', 'grade'],
    plan: ['read'],
    portfolio: ['read', 'write'],
    attendance: ['read', 'take'],
    drive: ['read', 'upload'],
    report: ['read', 'comment'],
  }),
  class_member: ac.newRole({
    ...communityRead,
    academics: ['read'],
    assessment: ['read'],
    plan: ['read'],
    portfolio: ['read'],
    attendance: ['read'],
    drive: ['read', 'upload'],
  }),
  student: ac.newRole({
    ...communityRead,
    assessment: ['read'],
    plan: ['read'],
    portfolio: ['read', 'write'],
    attendance: ['read'],
    drive: ['read'],
    report: ['read'],
  }),
  guardian: ac.newRole({
    ...communityRead,
    assessment: ['read'],
    portfolio: ['read'],
    attendance: ['read'],
    drive: ['read'],
    report: ['read'],
    invoice: ['read'],
    payment: ['read'],
  }),
  applicant: ac.newRole({
    announcement: ['read'],
    application: ['submit'],
    invoice: ['read'],
    payment: ['read'],
  }),
};

export type Role = keyof typeof roles;

export const ROLES = Object.keys(roles) as Role[];

export const isRole = (value: string): value is Role => value in roles;

/** Better Auth stores several roles as one comma-separated string. */
export function parseRoles(stored: string): Role[] {
  return stored
    .split(',')
    .map((role) => role.trim())
    .filter(isRole);
}

type AuthorizeRequest = Parameters<(typeof roles)[Role]['authorize']>[0];

/** A member with several roles holds the union of their permissions. */
export function rolesAllow(
  memberRoles: Role[],
  required: Permissions,
): boolean {
  return Object.entries(required).every(([resource, actions]) =>
    (actions ?? []).every((action) =>
      memberRoles.some(
        (role) =>
          roles[role].authorize({ [resource]: [action] } as AuthorizeRequest)
            .success,
      ),
    ),
  );
}
