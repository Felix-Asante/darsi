import { env } from "@/common/config/env";
import { schoolSlugFromHost } from "@/common/school/school-slug";
import { createAcademicsService } from "../academics/index.service";
import type { IAcademicsService } from "../academics/interface";
import { createAnnouncementsService } from "../announcements/index.service";
import type { IAnnouncementsService } from "../announcements/interface";
import { createAssessmentService } from "../assessment/index.service";
import type { IAssessmentService } from "../assessment/interface";
import { createAttendanceService } from "../attendance/index.service";
import type { IAttendanceService } from "../attendance/interface";
import { createAuthService } from "../auth/index.service";
import type { IAuthService } from "../auth/interface";
import { createAdmissionsService } from "../admissions/index.service";
import type { IAdmissionsService } from "../admissions/interface";
import { createBillingService } from "../billing/index.service";
import type { IBillingService } from "../billing/interface";
import { createCalendarService } from "../calendar/index.service";
import type { ICalendarService } from "../calendar/interface";
import { createCurriculumService } from "../curriculum/index.service";
import type { ICurriculumService } from "../curriculum/interface";
import { createFilesService } from "../files/index.service";
import type { IFilesService } from "../files/interface";
import { createGradingService } from "../grading/index.service";
import type { IGradingService } from "../grading/interface";
import { createHealthService } from "../health/index.service";
import type { IHealthService } from "../health/interface";
import {
  createHttpClient,
  type HttpClient,
  type HttpClientConfig,
} from "../http.service";
import { createImportsService } from "../imports/index.service";
import type { IImportsService } from "../imports/interface";
import { createMeService } from "../me/index.service";
import type { IMeService } from "../me/interface";
import { createMembersService } from "../members/index.service";
import type { IMembersService } from "../members/interface";
import { createNotificationsService } from "../notifications/index.service";
import type { INotificationsService } from "../notifications/interface";
import { createPeopleService } from "../people/index.service";
import type { IPeopleService } from "../people/interface";
import { createTimetablesService } from "../timetables/index.service";
import type { ITimetablesService } from "../timetables/interface";
import { createPlanningService } from "../planning/index.service";
import type { IPlanningService } from "../planning/interface";
import { createPortfolioService } from "../portfolio/index.service";
import type { IPortfolioService } from "../portfolio/interface";
import { createReportsService } from "../reports/index.service";
import type { IReportsService } from "../reports/interface";
import { createSchoolService } from "../school/index.service";
import type { ISchoolService } from "../school/interface";

class ApiService {
  readonly http: HttpClient;

  health: IHealthService;
  auth: IAuthService;
  members: IMembersService;
  me: IMeService;
  school: ISchoolService;
  notifications: INotificationsService;
  academics: IAcademicsService;
  people: IPeopleService;
  curriculum: ICurriculumService;
  imports: IImportsService;
  calendar: ICalendarService;
  timetables: ITimetablesService;
  grading: IGradingService;
  assessment: IAssessmentService;
  attendance: IAttendanceService;
  announcements: IAnnouncementsService;
  planning: IPlanningService;
  files: IFilesService;
  portfolio: IPortfolioService;
  reports: IReportsService;
  billing: IBillingService;
  admissions: IAdmissionsService;

  constructor(config: HttpClientConfig) {
    this.http = createHttpClient(config);
    this.health = createHealthService(this.http);
    this.auth = createAuthService(this.http);
    this.members = createMembersService(this.http);
    this.me = createMeService(this.http);
    this.school = createSchoolService(this.http);
    this.notifications = createNotificationsService(this.http);
    this.academics = createAcademicsService(this.http);
    this.people = createPeopleService(this.http);
    this.curriculum = createCurriculumService(this.http);
    this.imports = createImportsService(this.http);
    this.calendar = createCalendarService(this.http);
    this.timetables = createTimetablesService(this.http);
    this.grading = createGradingService(this.http);
    this.assessment = createAssessmentService(this.http);
    this.attendance = createAttendanceService(this.http);
    this.announcements = createAnnouncementsService(this.http);
    this.planning = createPlanningService(this.http);
    this.files = createFilesService(this.http);
    this.portfolio = createPortfolioService(this.http);
    this.reports = createReportsService(this.http);
    this.billing = createBillingService(this.http);
    this.admissions = createAdmissionsService(this.http);
  }
}

const currentSchoolSlug = () =>
  typeof window === "undefined"
    ? null
    : schoolSlugFromHost(window.location.host, env.NEXT_PUBLIC_ROOT_DOMAIN);

export const api = new ApiService({ getSchoolSlug: currentSchoolSlug });
