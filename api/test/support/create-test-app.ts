import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { inject } from 'vitest';

/**
 * Boots the real AppModule against the test containers. The modules are
 * imported after the environment is set, because ConfigModule reads it on import.
 */
export async function createTestApp(): Promise<INestApplication> {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    LOG_LEVEL: 'warn',
    DATABASE_URL: inject('databaseUrl'),
    REDIS_URL: inject('redisUrl'),
    CORS_ORIGINS: 'http://localhost:3000',
    API_URL: 'http://localhost:8080',
    APP_URL: 'http://localhost:3000',
    AUTH_SECRET: 'test-secret-that-is-long-enough-for-better-auth',
    MAIL_TRANSPORT: 'memory',
    S3_ENDPOINT: inject('s3Endpoint'),
    S3_FORCE_PATH_STYLE: 'true',
    S3_ACCESS_KEY_ID: 'test',
    S3_SECRET_ACCESS_KEY: 'test',
    MALWARE_SCANNER: 'test',
    GOTENBERG_URL: inject('gotenbergUrl'),
    STRIPE_SECRET_KEY: 'sk_test_not_used',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
  });

  const { AppModule } = await import('../../src/app.module.js');
  const { configureApp } = await import('../../src/app.setup.js');

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication({
    bufferLogs: true,
    rawBody: true,
  });
  configureApp(app);
  await app.init();
  return app;
}
