import { Module } from '@nestjs/common';
import { AnnouncementsModule } from './announcements.module.js';
import { AnnouncementsProcessor } from './announcements.processor.js';

/** Registered in the worker only: scheduled announcements are sent at their time. */
@Module({
  imports: [AnnouncementsModule],
  providers: [AnnouncementsProcessor],
})
export class AnnouncementsWorkerModule {}
