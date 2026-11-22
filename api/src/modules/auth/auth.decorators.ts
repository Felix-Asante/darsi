import { SetMetadata } from '@nestjs/common';
import type { Permissions } from './access-control.js';

export const IS_PUBLIC = 'auth:public';
export const SCHOOL_OPTIONAL = 'auth:schoolOptional';
export const REQUIRED_PERMISSIONS = 'auth:permissions';

/** No session needed: health checks, public application forms, webhooks. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Signed in, but not acting in a school yet: the user's profile, the list of their schools. */
export const SchoolOptional = () => SetMetadata(SCHOOL_OPTIONAL, true);

/** The member's roles must grant every listed action in the current school. */
export const RequirePermission = (permissions: Permissions) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);
