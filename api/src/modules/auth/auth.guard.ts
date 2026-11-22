import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { DataSource } from 'typeorm';
import { ProblemException } from '../../common/errors/problem.exception.js';
import { RequestContext } from '../../common/tenancy/request-context.js';
import { type Permissions, parseRoles, rolesAllow } from './access-control.js';
import {
  IS_PUBLIC,
  REQUIRED_PERMISSIONS,
  SCHOOL_OPTIONAL,
} from './auth.decorators.js';
import { AUTH, type Auth } from './auth.factory.js';
import { Member } from './entities/member.entity.js';
import { Organization } from './entities/organization.entity.js';

export const SCHOOL_HEADER = 'x-school-slug';

/**
 * Runs before every route: who is calling (Better Auth session), in which
 * school (subdomain header, else the session's active school), with which
 * roles (membership), and whether those roles allow the route.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    private readonly reflector: Reflector,
    private readonly dataSource: DataSource,
    private readonly context: RequestContext,
  ) {}

  async canActivate(execution: ExecutionContext): Promise<boolean> {
    const targets = [execution.getHandler(), execution.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets))
      return true;

    const request = execution.switchToHttp().getRequest<Request>();
    const result = await this.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    if (!result) throw new UnauthorizedException();
    this.context.setUser(result.user.id);

    const schoolOptional = this.reflector.getAllAndOverride<boolean>(
      SCHOOL_OPTIONAL,
      targets,
    );
    const schoolId = await this.resolveSchoolId(
      request,
      result.user.id,
      result.session.activeOrganizationId,
    );
    if (!schoolId) {
      if (schoolOptional) return true;
      throw new ProblemException(
        HttpStatus.FORBIDDEN,
        'school_required',
        'No school selected',
      );
    }

    const member = await this.dataSource
      .getRepository(Member)
      .findOneBy({ organizationId: schoolId, userId: result.user.id });
    if (!member) {
      if (schoolOptional) return true;
      throw new ProblemException(
        HttpStatus.FORBIDDEN,
        'not_a_member',
        'Not a member of this school',
      );
    }

    const roles = parseRoles(member.role);
    this.context.setSchool(schoolId, roles);

    const required = this.reflector.getAllAndOverride<Permissions | undefined>(
      REQUIRED_PERMISSIONS,
      targets,
    );
    if (required && !rolesAllow(roles, required))
      throw new ForbiddenException();
    return true;
  }

  /** The subdomain's school, else the session's active school, else the user's only school. */
  private async resolveSchoolId(
    request: Request,
    userId: string,
    activeOrganizationId?: string | null,
  ) {
    const slug = request.headers[SCHOOL_HEADER];
    if (typeof slug === 'string' && slug) {
      const school = await this.dataSource
        .getRepository(Organization)
        .findOneBy({ slug: slug.toLowerCase() });
      if (!school)
        throw new ProblemException(
          HttpStatus.NOT_FOUND,
          'school_not_found',
          'Unknown school',
        );
      return school.id;
    }
    if (activeOrganizationId) return activeOrganizationId;

    const memberships = await this.dataSource
      .getRepository(Member)
      .find({ where: { userId }, take: 2 });
    return memberships.length === 1 ? memberships[0].organizationId : undefined;
  }
}
