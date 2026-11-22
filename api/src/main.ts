import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import type { EnvironmentVariables } from './config/env.validation.js';

const app = await NestFactory.create(AppModule, {
  bufferLogs: true,
  rawBody: true,
});
configureApp(app);

const config =
  app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
await app.listen(config.get('PORT', { infer: true }));
