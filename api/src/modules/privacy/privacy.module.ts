import { Module } from '@nestjs/common';
import { AssessmentModule } from '../assessment/assessment.module.js';
import { AttendanceModule } from '../attendance/attendance.module.js';
import { FilesModule } from '../files/files.module.js';
import { PeopleModule } from '../people/people.module.js';
import { PortfolioModule } from '../portfolio/portfolio.module.js';
import { SchoolsModule } from '../schools/schools.module.js';
import { PrivacyController } from './privacy.controller.js';
import { PrivacyService } from './privacy.service.js';

@Module({
  imports: [
    PeopleModule,
    AssessmentModule,
    AttendanceModule,
    FilesModule,
    PortfolioModule,
    SchoolsModule,
  ],
  controllers: [PrivacyController],
  providers: [PrivacyService],
})
export class PrivacyModule {}
