import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  IMPORTS_QUEUE,
  type ImportQueueJob,
  ImportsService,
} from './imports.service.js';

@Processor(IMPORTS_QUEUE, { concurrency: 2 })
export class ImportsProcessor extends WorkerHost {
  constructor(private readonly imports: ImportsService) {
    super();
  }

  process(job: Job<ImportQueueJob>) {
    return this.imports.process(job.data);
  }
}
