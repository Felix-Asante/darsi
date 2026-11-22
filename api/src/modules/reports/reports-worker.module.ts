import { Module } from '@nestjs/common';
import { ReportsModule } from './reports.module.js';
import { ReportsProcessor } from './reports.processor.js';

/** Registered in the worker only: report PDFs are rendered there. */
@Module({
  imports: [ReportsModule],
  providers: [ReportsProcessor],
})
export class ReportsWorkerModule {}
