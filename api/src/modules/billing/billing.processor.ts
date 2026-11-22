import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  BILLING_QUEUE,
  InvoicesService,
  type ReminderJob,
} from './invoices.service.js';

@Processor(BILLING_QUEUE)
export class BillingProcessor extends WorkerHost {
  constructor(private readonly invoices: InvoicesService) {
    super();
  }

  process(job: Job<ReminderJob>) {
    return this.invoices.remind(job.data);
  }
}
