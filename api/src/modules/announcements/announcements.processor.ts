import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  ANNOUNCEMENTS_QUEUE,
  AnnouncementsService,
  type PublishJob,
} from './announcements.service.js';

@Processor(ANNOUNCEMENTS_QUEUE)
export class AnnouncementsProcessor extends WorkerHost {
  constructor(private readonly announcements: AnnouncementsService) {
    super();
  }

  process(job: Job<PublishJob>) {
    return this.announcements.publishScheduled(job.data);
  }
}
