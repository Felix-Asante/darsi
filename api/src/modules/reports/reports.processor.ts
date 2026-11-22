import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  DOCUMENTS_QUEUE,
  type GenerateReportJob,
  ReportsService,
} from './reports.service.js';

@Processor(DOCUMENTS_QUEUE)
export class ReportsProcessor extends WorkerHost {
  constructor(private readonly reports: ReportsService) {
    super();
  }

  process(job: Job<GenerateReportJob>) {
    return this.reports.generate(job.data);
  }
}
