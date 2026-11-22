import { redisStorage } from '@better-auth/redis-storage';
import { APIError, betterAuth, type BetterAuthOptions } from 'better-auth';
import { organization } from 'better-auth/plugins';
import { captcha } from 'better-auth/plugins/captcha';
import type { Redis } from 'ioredis';
import { Pool } from 'pg';
import { v7 as uuidv7 } from 'uuid';
import type { MailOutbox } from '../mail/mail-outbox.service.js';
import { ac, parseRoles, roles } from './access-control.js';

export interface AuthDependencies {
  databaseUrl: string;
  redis: Redis;
  mail: MailOutbox;
  apiUrl: string;
  appUrl: string;
  secret: string;
  trustedOrigins: string[];
  cookieDomain?: string;
  google?: { clientId: string; clientSecret: string };
  turnstileSecretKey?: string;
  production: boolean;
  rateLimit: boolean;
  onSignIn: (session: {
    userId: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }) => Promise<void>;
  onMembershipChange: (change: MembershipChange) => Promise<void>;
  /** The school of a member who has never signed in, so their link reads as account setup. */
  pendingSetupSchool: (userId: string) => Promise<string | null>;
}

export interface MembershipChange {
  action: 'member.added' | 'member.removed' | 'member.role_changed';
  schoolId: string;
  memberId: string;
  userId: string;
  email: string;
  before: string | null;
  after: string | null;
}

function assertDarsiRoles(stored: string) {
  const requested = stored.split(',').map((role) => role.trim());
  if (parseRoles(stored).length !== requested.length) {
    throw new APIError('BAD_REQUEST', {
      message: 'Unknown role',
      code: 'UNKNOWN_ROLE',
    });
  }
}

const toSnakeCase = (value: string) =>
  value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

/** Maps Better Auth's camelCase fields to Darsi's snake_case columns. */
const columns = (...fields: string[]) =>
  Object.fromEntries(fields.map((field) => [field, toSnakeCase(field)]));

export function createAuth(deps: AuthDependencies) {
  const memberAdded = (
    member: {
      id: string;
      organizationId: string;
      userId: string;
      role: string;
    },
    email: string,
  ) =>
    deps.onMembershipChange({
      action: 'member.added',
      schoolId: member.organizationId,
      memberId: member.id,
      userId: member.userId,
      email,
      before: null,
      after: member.role,
    });

  const options = {
    appName: 'Darsi',
    baseURL: deps.apiUrl,
    basePath: '/api/auth',
    secret: deps.secret,
    database: new Pool({ connectionString: deps.databaseUrl, max: 10 }),
    secondaryStorage: redisStorage({ client: deps.redis, keyPrefix: 'auth:' }),
    trustedOrigins: deps.trustedOrigins,
    advanced: {
      database: { generateId: () => uuidv7() },
      useSecureCookies: deps.production,
      cookiePrefix: 'darsi',
      crossSubDomainCookies: deps.cookieDomain
        ? { enabled: true, domain: deps.cookieDomain }
        : undefined,
    },
    user: {
      modelName: 'users',
      fields: columns('emailVerified', 'createdAt', 'updatedAt'),
      additionalFields: {
        locale: {
          type: 'string',
          required: false,
          defaultValue: 'en',
          input: true,
        },
      },
    },
    session: {
      modelName: 'sessions',
      fields: columns(
        'expiresAt',
        'createdAt',
        'updatedAt',
        'ipAddress',
        'userAgent',
        'userId',
      ),
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 60 * 5 },
      storeSessionInDatabase: true,
    },
    account: {
      modelName: 'accounts',
      fields: columns(
        'accountId',
        'providerId',
        'userId',
        'accessToken',
        'refreshToken',
        'idToken',
        'accessTokenExpiresAt',
        'refreshTokenExpiresAt',
        'createdAt',
        'updatedAt',
      ),
      accountLinking: { enabled: true, trustedProviders: ['google'] },
    },
    verification: {
      modelName: 'verifications',
      fields: columns('expiresAt', 'createdAt', 'updatedAt'),
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 10,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        const { locale } = user as typeof user & { locale?: string };
        const schoolName = await deps.pendingSetupSchool(user.id);
        await deps.mail.queue(
          schoolName
            ? {
                mail: 'account-setup',
                to: user.email,
                locale,
                data: { name: user.name, schoolName, url },
              }
            : {
                mail: 'reset-password',
                to: user.email,
                locale,
                data: { name: user.name, url },
              },
        );
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        const existing = user as typeof user & { locale?: string };
        await deps.mail.queue({
          mail: 'verify-email',
          to: user.email,
          locale: existing.locale,
          data: { name: user.name, url },
        });
      },
    },
    socialProviders: deps.google ? { google: deps.google } : undefined,
    rateLimit: {
      enabled: deps.rateLimit,
      storage: 'secondary-storage',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 3 },
        '/request-password-reset': { window: 300, max: 3 },
      },
    },
    databaseHooks: {
      session: {
        create: {
          after: async (session) => {
            await deps.onSignIn(session);
          },
        },
      },
    },
    plugins: [
      organization({
        ac,
        roles,
        creatorRole: 'admin',
        organizationHooks: {
          beforeAddMember: async ({ member }) => assertDarsiRoles(member.role),
          beforeUpdateMemberRole: async ({ newRole }) =>
            assertDarsiRoles(newRole),
          beforeCreateInvitation: async ({ invitation }) =>
            assertDarsiRoles(invitation.role),
          afterAddMember: async ({ member, user }) =>
            memberAdded(member, user.email),
          // Accepting an invitation adds the member without calling afterAddMember.
          afterAcceptInvitation: async ({ member, user }) =>
            memberAdded(member, user.email),
          afterRemoveMember: async ({ member, user }) =>
            deps.onMembershipChange({
              action: 'member.removed',
              schoolId: member.organizationId,
              memberId: member.id,
              userId: member.userId,
              email: user.email,
              before: member.role,
              after: null,
            }),
          afterUpdateMemberRole: async ({ member, previousRole, user }) =>
            deps.onMembershipChange({
              action: 'member.role_changed',
              schoolId: member.organizationId,
              memberId: member.id,
              userId: member.userId,
              email: user.email,
              before: previousRole,
              after: member.role,
            }),
        },
        allowUserToCreateOrganization: false,
        invitationExpiresIn: 60 * 60 * 24 * 7,
        requireEmailVerificationOnInvitation: true,
        sendInvitationEmail: async ({
          id,
          email,
          role,
          organization: school,
          invitation,
          inviter,
        }) => {
          await deps.mail.queue({
            mail: 'invitation',
            to: email,
            locale: (inviter.user as { locale?: string }).locale,
            data: {
              inviterName: inviter.user.name,
              schoolName: school.name,
              roles: parseRoles(role),
              url: `${deps.appUrl}/accept-invitation/${id}`,
              expiresAt: new Date(invitation.expiresAt).toISOString(),
            },
          });
        },
        schema: {
          organization: {
            modelName: 'organizations',
            fields: columns('createdAt'),
          },
          member: {
            modelName: 'members',
            fields: columns('organizationId', 'userId', 'createdAt'),
          },
          invitation: {
            modelName: 'invitations',
            fields: columns(
              'organizationId',
              'expiresAt',
              'createdAt',
              'inviterId',
            ),
          },
          session: { fields: columns('activeOrganizationId') },
        },
      }),
      ...(deps.turnstileSecretKey
        ? [
            captcha({
              provider: 'cloudflare-turnstile',
              secretKey: deps.turnstileSecretKey,
              endpoints: ['/sign-up/email', '/request-password-reset'],
            }),
          ]
        : []),
    ],
  } satisfies BetterAuthOptions;

  return betterAuth(options);
}

export type Auth = ReturnType<typeof createAuth>;

export const AUTH = Symbol('AUTH');
