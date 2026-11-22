import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ProblemException } from '../../common/errors/problem.exception.js';
import { AuditService } from '../audit/audit.service.js';
import { parseRoles, type Role } from '../auth/access-control.js';
import { AUTH, type Auth } from '../auth/auth.factory.js';

interface MemberRow {
  id: string;
  userId: string;
  role: string;
}

/**
 * Applicant memberships, through Better Auth: families join a school as
 * applicants (ADMS-3) and become guardians when they accept a place (ADMS-11).
 */
@Injectable()
export class MembershipService {
  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    private readonly audit: AuditService,
  ) {}

  private async member(
    schoolId: string,
    userId: string,
  ): Promise<MemberRow | null> {
    const { adapter } = await this.auth.$context;
    return adapter.findOne<MemberRow>({
      model: 'member',
      where: [
        { field: 'organizationId', value: schoolId },
        { field: 'userId', value: userId },
      ],
    });
  }

  /** Adds the applicant role, whether the user is new to the school or already a guardian there. Runs in the school. */
  async join(schoolId: string, userId: string): Promise<Role[]> {
    const existing = await this.member(schoolId, userId);
    if (!existing) {
      // Server-only Better Auth call: not reachable over HTTP, so this endpoint is the only door.
      await this.auth.api.addMember({
        body: { userId, role: 'applicant', organizationId: schoolId },
      });
      return ['applicant'];
    }
    const roles = parseRoles(existing.role);
    if (roles.includes('applicant')) return roles;
    if (roles.some((role) => role !== 'guardian')) {
      // Staff apply through the office, not as a family.
      throw new ProblemException(
        HttpStatus.CONFLICT,
        'staff_cannot_apply',
        'Staff members cannot apply as a family',
      );
    }
    return this.setRoles(existing, [...roles, 'applicant']);
  }

  /** An accepted family: guardian from now on, keeping the applicant role while other applications are open. */
  async makeGuardian(
    schoolId: string,
    userId: string,
    keepApplicant: boolean,
  ): Promise<void> {
    const existing = await this.member(schoolId, userId);
    if (!existing) return;
    const roles = parseRoles(existing.role);
    const next = [
      ...new Set([
        ...roles.filter((role) => keepApplicant || role !== 'applicant'),
        'guardian' as Role,
      ]),
    ];
    if (
      next.length === roles.length &&
      next.every((role) => roles.includes(role))
    )
      return;
    await this.setRoles(existing, next);
  }

  private async setRoles(member: MemberRow, roles: Role[]): Promise<Role[]> {
    const { adapter } = await this.auth.$context;
    await adapter.update({
      model: 'member',
      where: [{ field: 'id', value: member.id }],
      update: { role: roles.join(',') },
    });
    // Better Auth's role hooks only run for its HTTP endpoint, so the change is audited here.
    await this.audit.record({
      action: 'member.role_changed',
      entityType: 'member',
      entityId: member.id,
      before: { userId: member.userId, roles: parseRoles(member.role) },
      after: { userId: member.userId, roles },
    });
    return roles;
  }
}
