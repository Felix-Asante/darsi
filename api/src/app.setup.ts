import { type INestApplication, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { toNodeHandler } from 'better-auth/node';
import type { Express } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { isAllowedOrigin } from './common/http/cors.js';
import { requireTrustedOrigin } from './common/http/csrf.js';
import { createValidationPipe } from './common/pipes/validation.pipe.js';
import { type EnvironmentVariables, NodeEnv } from './config/env.validation.js';
import { AUTH, type Auth } from './modules/auth/auth.factory.js';

export function configureApp(app: INestApplication): void {
  const config =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  const origins = config.get('CORS_ORIGINS', { infer: true });

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  });
  app.use(helmet());
  app.enableCors({
    credentials: true,
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow: boolean) => void,
    ) => callback(null, !origin || isAllowedOrigin(origin, origins)),
  });
  // Better Auth reads the raw body, so it is mounted before Nest's body parser.
  const http = app.getHttpAdapter().getInstance() as Express;
  http.all('/api/auth/*splat', toNodeHandler(app.get<Auth>(AUTH)));
  // After Better Auth, which checks origins itself, and before any business route.
  app.use('/api/v1', requireTrustedOrigin(origins, ['/billing/webhooks/']));
  // CSV imports arrive as JSON text; everything else is far smaller.
  (app as NestExpressApplication).useBodyParser('json', { limit: '5mb' });
  app.useGlobalPipes(createValidationPipe());
  app.enableShutdownHooks();

  if (config.get('NODE_ENV', { infer: true }) !== NodeEnv.Production) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Darsi API').setVersion('1').build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }
}
