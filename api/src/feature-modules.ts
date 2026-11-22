import { AcademicsModule } from './modules/academics/academics.module.js';
import { AnnouncementsModule } from './modules/announcements/announcements.module.js';
import { AssessmentModule } from './modules/assessment/assessment.module.js';
import { AttendanceModule } from './modules/attendance/attendance.module.js';
import { AdmissionsModule } from './modules/admissions/admissions.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { CalendarModule } from './modules/calendar/calendar.module.js';
import { CurriculumModule } from './modules/curriculum/curriculum.module.js';
import { FilesModule } from './modules/files/files.module.js';
import { ImportsModule } from './modules/imports/imports.module.js';
import { MeModule } from './modules/me/me.module.js';
import { PeopleModule } from './modules/people/people.module.js';
import { PortfolioModule } from './modules/portfolio/portfolio.module.js';
import { PrivacyModule } from './modules/privacy/privacy.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { PlanningModule } from './modules/planning/planning.module.js';
import { PoliciesModule } from './modules/policies/policies.module.js';
import { SchoolsModule } from './modules/schools/schools.module.js';
import { TimetablesModule } from './modules/timetables/timetables.module.js';

/** Product modules, loaded by the API (controllers) and the worker (outbox handlers, queues). */
export const FEATURE_MODULES = [
  PoliciesModule,
  SchoolsModule,
  MeModule,
  AcademicsModule,
  PeopleModule,
  CurriculumModule,
  ImportsModule,
  CalendarModule,
  TimetablesModule,
  AssessmentModule,
  AttendanceModule,
  AnnouncementsModule,
  PlanningModule,
  FilesModule,
  ReportsModule,
  PortfolioModule,
  PrivacyModule,
  BillingModule,
  AdmissionsModule,
];
