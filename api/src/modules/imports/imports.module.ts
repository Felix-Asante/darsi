import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicsModule } from '../academics/academics.module.js';
import { CurriculumModule } from '../curriculum/curriculum.module.js';
import { PeopleModule } from '../people/people.module.js';
import { TimetablesModule } from '../timetables/timetables.module.js';
import { ImportJob } from './entities/import-job.entity.js';
import { ImportRows } from './import-rows.js';
import { ImportsController } from './imports.controller.js';
import { IMPORTS_QUEUE, ImportsService } from './imports.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([ImportJob]),
    BullModule.registerQueue({ name: IMPORTS_QUEUE }),
    AcademicsModule,
    PeopleModule,
    CurriculumModule,
    TimetablesModule,
  ],
  controllers: [ImportsController],
  providers: [ImportsService, ImportRows],
  exports: [ImportsService],
})
export class ImportsModule {}
