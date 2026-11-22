import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicsModule } from '../academics/academics.module.js';
import { PeopleModule } from '../people/people.module.js';
import { SchoolsModule } from '../schools/schools.module.js';
import {
  Announcement,
  ClassAnnouncementSettings,
} from './announcement.entities.js';
import { AnnouncementsController } from './announcements.controller.js';
import {
  ANNOUNCEMENTS_QUEUE,
  AnnouncementsService,
} from './announcements.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Announcement, ClassAnnouncementSettings]),
    BullModule.registerQueue({ name: ANNOUNCEMENTS_QUEUE }),
    AcademicsModule,
    PeopleModule,
    SchoolsModule,
  ],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
