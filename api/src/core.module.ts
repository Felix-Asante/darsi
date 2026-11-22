import { BullModule } from '@nestjs/bullmq';
import { type DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { ClsModule } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';
import { requestIdFor } from './common/http/request-id.js';
import { RedisModule } from './common/redis/redis.module.js';
import { TenancyModule } from './common/tenancy/tenancy.module.js';
import {
  type EnvironmentVariables,
  validateEnv,
} from './config/env.validation.js';
import { buildLoggerParams } from './config/logger.config.js';
import { DatabaseModule } from './database/database.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { MailPlatformModule } from './modules/mail/mail-platform.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { OutboxPlatformModule } from './modules/outbox/outbox-platform.module.js';

/** Infrastructure shared by the API, the worker and the CLI. */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true, generateId: true, idGenerator: requestIdFor },
      plugins: [
        new ClsPluginTransactional({
          imports: [TypeOrmModule],
          adapter: new TransactionalAdapterTypeOrm({
            dataSourceToken: getDataSourceToken(),
          }),
        }),
      ],
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
        buildLoggerParams({
          NODE_ENV: config.get('NODE_ENV', { infer: true }),
          LOG_LEVEL: config.get('LOG_LEVEL', { infer: true }),
        }),
    }),
    DatabaseModule,
    RedisModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        connection: { url: config.get('REDIS_URL', { infer: true }) },
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      }),
    }),
    TenancyModule,
    AuditModule,
  ],
})
export class CoreModule {
  /** Only the worker runs the outbox relay; the API and the CLI only add messages. */
  static register({ relay }: { relay: boolean }): DynamicModule {
    return {
      module: CoreModule,
      imports: [
        OutboxPlatformModule.register({ relay }),
        MailPlatformModule,
        AuthModule,
        NotificationsModule,
      ],
    };
  }
}
