import {
  type Permissions,
  parseRoles,
  type Role,
  rolesAllow,
} from './access-control.js';

const can = (role: Role | Role[], permissions: Permissions) =>
  rolesAllow(Array.isArray(role) ? role : [role], permissions);

describe('roles follow the PRD permissions matrix', () => {
  it('lets only teachers publish grades; assistants draft', () => {
    expect(can('teacher', { assessment: ['publish'] })).toBe(true);
    expect(can('teaching_assistant', { assessment: ['grade'] })).toBe(true);
    expect(can('teaching_assistant', { assessment: ['publish'] })).toBe(false);
  });

  it('keeps fees and applications away from academic staff', () => {
    for (const role of [
      'teacher',
      'teaching_assistant',
      'class_member',
      'student',
    ] as Role[]) {
      expect(can(role, { invoice: ['read'] }), role).toBe(false);
      expect(can(role, { application: ['read'] }), role).toBe(false);
    }
  });

  it('lets families handle only their own applications; staff read them', () => {
    expect(can('applicant', { application: ['submit'] })).toBe(true);
    expect(can('applicant', { application: ['read'] })).toBe(false);
    expect(can('guardian', { application: ['submit'] })).toBe(false);
    expect(
      can('admissions_officer', { application: ['read', 'manage', 'decide'] }),
    ).toBe(true);
    expect(can('admin', { application: ['read'] })).toBe(true);
    expect(can('admin', { application: ['manage'] })).toBe(false);
  });

  it('lets finance officers issue, credit and refund; admins only read money', () => {
    expect(
      can('finance_officer', {
        invoice: ['issue', 'credit'],
        payment: ['refund'],
      }),
    ).toBe(true);
    expect(can('admin', { invoice: ['read'] })).toBe(true);
    expect(can('admin', { invoice: ['issue'] })).toBe(false);
    expect(can('admin', { payment: ['refund'] })).toBe(false);
  });

  it('lets guardians see their invoices but not risk flags', () => {
    expect(can('guardian', { invoice: ['read'], payment: ['read'] })).toBe(
      true,
    );
    expect(can('guardian', { riskFlag: ['read'] })).toBe(false);
    expect(can('teaching_assistant', { riskFlag: ['read'] })).toBe(false);
  });

  it('lets coordinators approve reports, which teachers cannot', () => {
    expect(can('coordinator', { report: ['approve'] })).toBe(true);
    expect(can('teacher', { report: ['approve'] })).toBe(false);
  });

  it('lets admins manage members and invitations', () => {
    expect(
      can('admin', {
        member: ['create', 'update', 'delete'],
        invitation: ['create', 'cancel'],
      }),
    ).toBe(true);
    expect(can('teacher', { invitation: ['create'] })).toBe(false);
  });

  it('gives a member with several roles the union of their permissions', () => {
    expect(
      can(['teacher', 'guardian'], {
        assessment: ['publish'],
        invoice: ['read'],
      }),
    ).toBe(true);
    expect(
      can(['teacher'], { assessment: ['publish'], invoice: ['read'] }),
    ).toBe(false);
  });

  it('allows nothing without a role', () => {
    expect(can([], { announcement: ['read'] })).toBe(false);
  });
});

describe('parseRoles', () => {
  it('reads Better Auth’s comma-separated roles and drops unknown ones', () => {
    expect(parseRoles('teacher, guardian')).toEqual(['teacher', 'guardian']);
    expect(parseRoles('owner,admin')).toEqual(['admin']);
  });
});
