import {
  Global,
  Inject,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Redis } from 'ioredis';
import { Outbox } from '@nestjs/outbox';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { DataSource, type EntityManager } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { REDIS } from '../../common/redis/redis.module.js';
import { TenantTransactions } from '../../common/tenancy/tenant-transactions.js';
import {
  type EnvironmentVariables,
  NodeEnv,
} from '../../config/env.validation.js';
import { AuditService } from '../audit/audit.service.js';
import { MailOutbox } from '../mail/mail-outbox.service.js';
import { MEMBER_ADDED, type MemberAddedEvent } from './auth.events.js';
import { AUTH, type Auth, createAuth } from './auth.factory.js';
import { AuthGuard } from './auth.guard.js';
import { Member } from './entities/member.entity.js';
import { Organization } from './entities/organization.entity.js';
import { SignInEvent } from './entities/sign-in-event.entity.js';
import { User } from './entities/user.entity.js';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Organization, Member, SignInEvent]),
  ],
  providers: [
    {
      provide: AUTH,
      inject: [
        ConfigService,
        REDIS,
        MailOutbox,
        DataSource,
        TenantTransactions,
        AuditService,
        Outbox,
        TransactionHost,
      ],
      useFactory: (
        config: ConfigService<EnvironmentVariables, true>,
        redis: Redis,
        mail: MailOutbox,
        dataSource: DataSource,
        transactions: TenantTransactions,
        audit: AuditService,
        outbox: Outbox<EntityManager>,
        txHost: TransactionHost<TransactionalAdapterTypeOrm>,
      ) => {
        const googleClientId = config.get('GOOGLE_CLIENT_ID', { infer: true });
        const googleClientSecret = config.get('GOOGLE_CLIENT_SECRET', {
          infer: true,
        });

        return createAuth({
          databaseUrl: config.get('DATABASE_URL', { infer: true }),
          redis,
          mail,
          apiUrl: config.get('API_URL', { infer: true }),
          appUrl: config.get('APP_URL', { infer: true }),
          secret: config.get('AUTH_SECRET', { infer: true }),
          trustedOrigins: config.get('CORS_ORIGINS', { infer: true }),
          cookieDomain: config.get('COOKIE_DOMAIN', { infer: true }),
          google:
            googleClientId && googleClientSecret
              ? { clientId: googleClientId, clientSecret: googleClientSecret }
              : undefined,
          turnstileSecretKey: config.get('TURNSTILE_SECRET_KEY', {
            infer: true,
          }),
          production:
            config.get('NODE_ENV', { infer: true }) === NodeEnv.Production,
          rateLimit: config.get('NODE_ENV', { infer: true }) !== NodeEnv.Test,
          onSignIn: async ({ userId, ipAddress, userAgent }) => {
            await dataSource.getRepository(SignInEvent).insert({
              id: uuidv7(),
              userId,
              ipAddress: ipAddress ?? null,
              userAgent: userAgent ?? null,
            });
          },
          pendingSetupSchool: async (userId) => {
            const [row] = await dataSource.query<{ name: string }[]>(
              `SELECT o.name FROM members m
                 JOIN organizations o ON o.id = m.organization_id
                WHERE m.user_id = $1
                  AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.user_id = $1)
                ORDER BY m.created_at
                LIMIT 1`,
              [userId],
            );
            return row?.name ?? null;
          },
          onMembershipChange: ({
            action,
            schoolId,
            memberId,
            userId,
            email,
            before,
            after,
          }) =>
            transactions.runInSchool(schoolId, async () => {
              await audit.record({
                action,
                entityType: 'member',
                entityId: memberId,
                before: before === null ? null : { userId, roles: before },
                after: after === null ? null : { userId, roles: after },
              });
              if (action === 'member.added') {
                const event: MemberAddedEvent = { schoolId, userId, email };
                await outbox.add(txHost.tx, {
                  topic: MEMBER_ADDED,
                  payload: event,
                });
                outbox.notify();
              }
            }),
        });
      },
    },
    AuthGuard,
  ],
  exports: [AUTH, AuthGuard],
})
export class AuthModule implements OnApplicationShutdown {
  constructor(@Inject(AUTH) private readonly auth: Auth) {}

  async onApplicationShutdown(): Promise<void> {
    const { database } = this.auth.options as {
      database: { end: () => Promise<void> };
    };
    await database.end();
  }
}
