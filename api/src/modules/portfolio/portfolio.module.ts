import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicsModule } from '../academics/academics.module.js';
import { AssessmentModule } from '../assessment/assessment.module.js';
import { AttendanceModule } from '../attendance/attendance.module.js';
import { FilesModule } from '../files/files.module.js';
import { PeopleModule } from '../people/people.module.js';
import { ReportsModule } from '../reports/reports.module.js';
import { SchoolsModule } from '../schools/schools.module.js';
import { TimetablesModule } from '../timetables/timetables.module.js';
import { PortfolioController } from './portfolio.controller.js';
import {
  PortfolioComment,
  PortfolioItem,
  PortfolioSettings,
} from './portfolio.entities.js';
import { PortfolioService } from './portfolio.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PortfolioSettings,
      PortfolioItem,
      PortfolioComment,
    ]),
    AcademicsModule,
    PeopleModule,
    FilesModule,
    TimetablesModule,
    AttendanceModule,
    AssessmentModule,
    ReportsModule,
    SchoolsModule,
  ],
  controllers: [PortfolioController],
  providers: [PortfolioService],
  exports: [PortfolioService],
})
export class PortfolioModule {}
