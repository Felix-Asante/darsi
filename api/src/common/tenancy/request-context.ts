import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ClsService, type ClsStore } from 'nestjs-cls';
import type { Role } from '../../modules/auth/access-control.js';

export interface RequestContextStore extends ClsStore {
  schoolId?: string;
  userId?: string;
  roles?: Role[];
}

@Injectable()
export class RequestContext {
  constructor(private readonly cls: ClsService<RequestContextStore>) {}

  get requestId(): string | undefined {
    return this.cls.isActive() ? this.cls.getId() : undefined;
  }

  get schoolId(): string | undefined {
    return this.cls.isActive() ? this.cls.get('schoolId') : undefined;
  }

  get userId(): string | undefined {
    return this.cls.isActive() ? this.cls.get('userId') : undefined;
  }

  get roles(): Role[] {
    return (this.cls.isActive() ? this.cls.get('roles') : undefined) ?? [];
  }

  hasRole(...roles: Role[]): boolean {
    return roles.some((role) => this.roles.includes(role));
  }

  /** The signed-in user; throws on routes that forgot to require a session. */
  requireUserId(): string {
    const userId = this.userId;
    if (!userId) throw new UnauthorizedException();
    return userId;
  }

  requireSchoolId(): string {
    const schoolId = this.schoolId;
    if (!schoolId) throw new UnauthorizedException();
    return schoolId;
  }

  setSchool(schoolId: string, roles: Role[] = []): void {
    this.cls.set('schoolId', schoolId);
    this.cls.set('roles', roles);
  }

  setUser(userId: string): void {
    this.cls.set('userId', userId);
  }
}
