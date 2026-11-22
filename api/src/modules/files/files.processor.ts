import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { FILES_QUEUE, FilesService, type ScanJob } from './files.service.js';

@Processor(FILES_QUEUE, { concurrency: 2 })
export class FilesProcessor extends WorkerHost {
  constructor(private readonly files: FilesService) {
    super();
  }

  process(job: Job<ScanJob>) {
    return this.files.scan(job.data);
  }
}
