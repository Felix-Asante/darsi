import { Module } from '@nestjs/common';
import { ImportsProcessor } from './imports.processor.js';
import { ImportsModule } from './imports.module.js';

/** Registered in the worker only, so the API never runs imports itself. */
@Module({
  imports: [ImportsModule],
  providers: [ImportsProcessor],
})
export class ImportsWorkerModule {}
