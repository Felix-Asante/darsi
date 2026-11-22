import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicsModule } from '../academics/academics.module.js';
import { BillingModule } from '../billing/billing.module.js';
import { FilesModule } from '../files/files.module.js';
import { PeopleModule } from '../people/people.module.js';
import { SchoolsModule } from '../schools/schools.module.js';
import { AdmissionsController } from './admissions.controller.js';
import { AdmissionsSetupService } from './admissions-setup.service.js';
import {
  AdmissionCycle,
  AdmissionForm,
  AdmissionStage,
  Application,
  ApplicationDocument,
  ApplicationNote,
  ReEnrolment,
} from './admissions.entities.js';
import { ApplicationsService } from './applications.service.js';
import { EnrolmentService } from './enrolment.service.js';
import { MembershipService } from './membership.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdmissionCycle,
      AdmissionForm,
      AdmissionStage,
      Application,
      ApplicationDocument,
      ApplicationNote,
      ReEnrolment,
    ]),
    AcademicsModule,
    PeopleModule,
    SchoolsModule,
    FilesModule,
    BillingModule,
  ],
  controllers: [AdmissionsController],
  providers: [
    AdmissionsSetupService,
    ApplicationsService,
    EnrolmentService,
    MembershipService,
  ],
})
export class AdmissionsModule {}
