import { Module } from '@nestjs/common';
import { BillingModule } from './billing.module.js';
import { BillingProcessor } from './billing.processor.js';

/** Registered in the worker only: payment reminders go out there. */
@Module({
  imports: [BillingModule],
  providers: [BillingProcessor],
})
export class BillingWorkerModule {}
