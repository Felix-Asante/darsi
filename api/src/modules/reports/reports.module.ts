import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicsModule } from '../academics/academics.module.js';
import { AssessmentModule } from '../assessment/assessment.module.js';
import { AttendanceModule } from '../attendance/attendance.module.js';
import { FilesModule } from '../files/files.module.js';
import { PeopleModule } from '../people/people.module.js';
import { SchoolsModule } from '../schools/schools.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { ReportCard, ReportEntry, ReportTemplate } from './report.entities.js';
import { ReportsController } from './reports.controller.js';
import { DOCUMENTS_QUEUE, ReportsService } from './reports.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReportTemplate, ReportCard, ReportEntry]),
    BullModule.registerQueue({ name: DOCUMENTS_QUEUE }),
    AcademicsModule,
    PeopleModule,
    AssessmentModule,
    AttendanceModule,
    FilesModule,
    SchoolsModule,
    DocumentsModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
