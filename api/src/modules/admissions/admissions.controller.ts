import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { TenantTransactions } from '../../common/tenancy/tenant-transactions.js';
import { RequestContext } from '../../common/tenancy/request-context.js';
import { AcademicsService } from '../academics/academics.service.js';
import { SCHOOL_HEADER } from '../auth/auth.guard.js';
import {
  Public,
  RequirePermission,
  SchoolOptional,
} from '../auth/auth.decorators.js';
import { SchoolsService } from '../schools/schools.service.js';
import {
  AdmissionsSetupService,
  cycleView,
  stageView,
} from './admissions-setup.service.js';
import {
  ApplicationDto,
  ApplicationQueryDto,
  CycleDto,
  DocumentDto,
  FormDto,
  MoveDto,
  NoteDto,
  OfferResponseDto,
  ReEnrolmentResponseDto,
  ReEnrolmentRunDto,
  StagesDto,
  WithdrawalDto,
} from './admissions.dto.js';
import { ApplicationsService } from './applications.service.js';
import { EnrolmentService } from './enrolment.service.js';
import { MembershipService } from './membership.service.js';

const id = new ParseUUIDPipe({ version: '7' });

@Controller('admissions')
export class AdmissionsController {
  constructor(
    private readonly setup: AdmissionsSetupService,
    private readonly applications: ApplicationsService,
    private readonly enrolment: EnrolmentService,
    private readonly membership: MembershipService,
    private readonly schools: SchoolsService,
    private readonly academics: AcademicsService,
    private readonly transactions: TenantTransactions,
    private readonly context: RequestContext,
  ) {}

  // ── Public (ADMS-3) ─────────────────────────────────────────────────

  /** The school's application page: who it is and which grades take applications now. */
  @Get('public')
  @Public()
  async publicPage(@Headers(SCHOOL_HEADER) slug: string | undefined) {
    const schoolId = slug ? await this.schools.idForSlug(slug) : null;
    if (!schoolId) throw new NotFoundException();
    return this.transactions.runInSchool(schoolId, async () => {
      const [school, cycles, divisions] = await Promise.all([
        this.schools.getCurrent(),
        this.setup.openCycles(),
        this.academics.listDivisions(),
      ]);
      const grades = divisions.flatMap((division) => division.gradeLevels);
      return {
        school: {
          name: school.name,
          logo: school.logo,
          defaultLocale: school.defaultLocale,
          currency: school.currency,
        },
        cycles: cycles.map((cycle) => ({
          id: cycle.id,
          name: cycle.name,
          closesOn: cycle.closesOn,
          applicationFee: cycle.applicationFee.toString(),
          grades: cycle.grades.flatMap(({ gradeLevelId }) => {
            const grade = grades.find((entry) => entry.id === gradeLevelId);
            return grade ? [{ id: grade.id, name: grade.name }] : [];
          }),
        })),
      };
    });
  }

  /** A signed-in family joins the school as an applicant. */
  @Post('join')
  @SchoolOptional()
  @HttpCode(HttpStatus.OK)
  async join(@Headers(SCHOOL_HEADER) slug: string | undefined) {
    const schoolId = slug ? await this.schools.idForSlug(slug) : null;
    if (!schoolId) throw new NotFoundException();
    const userId = this.context.requireUserId();
    const roles = await this.transactions.runInSchool(schoolId, () =>
      this.membership.join(schoolId, userId),
    );
    return { roles };
  }

  // ── The family (ADMS-4, ADMS-9) ─────────────────────────────────────

  @Get('my-applications')
  @RequirePermission({ application: ['submit'] })
  mine() {
    return this.applications.mine();
  }

  @Post('my-applications')
  @RequirePermission({ application: ['submit'] })
  create(@Body() dto: ApplicationDto) {
    return this.applications.create(dto);
  }

  @Get('my-applications/:id')
  @RequirePermission({ application: ['submit'] })
  getOwn(@Param('id', id) applicationId: string) {
    return this.applications.getOwn(applicationId);
  }

  @Put('my-applications/:id')
  @RequirePermission({ application: ['submit'] })
  update(@Param('id', id) applicationId: string, @Body() dto: ApplicationDto) {
    return this.applications.update(applicationId, dto);
  }

  @Delete('my-applications/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ application: ['submit'] })
  deleteDraft(@Param('id', id) applicationId: string) {
    return this.applications.deleteDraft(applicationId);
  }

  @Put('my-applications/:id/documents/:key')
  @RequirePermission({ application: ['submit'] })
  attach(
    @Param('id', id) applicationId: string,
    @Param('key') key: string,
    @Body() { fileId }: DocumentDto,
  ) {
    return this.applications.attachDocument(applicationId, key, fileId);
  }

  @Post('my-applications/:id/submit')
  @HttpCode(HttpStatus.OK)
  @RequirePermission({ application: ['submit'] })
  submit(@Param('id', id) applicationId: string) {
    return this.applications.submit(applicationId);
  }

  @Post('my-applications/:id/offer')
  @HttpCode(HttpStatus.OK)
  @RequirePermission({ application: ['submit'] })
  respond(
    @Param('id', id) applicationId: string,
    @Body() { response }: OfferResponseDto,
  ) {
    return this.applications.respond(applicationId, response);
  }

  // ── Setup (ADMS-1, ADMS-2, ADMS-5) ──────────────────────────────────

  @Get('cycles')
  @RequirePermission({ application: ['read'] })
  cycles() {
    return this.setup.cycles();
  }

  @Post('cycles')
  @RequirePermission({ application: ['manage'] })
  createCycle(@Body() dto: CycleDto) {
    return this.setup.saveCycle(dto);
  }

  @Put('cycles/:id')
  @RequirePermission({ application: ['manage'] })
  updateCycle(@Param('id', id) cycleId: string, @Body() dto: CycleDto) {
    return this.setup.saveCycle(dto, cycleId);
  }

  @Get('cycles/:id/places')
  @RequirePermission({ application: ['read'] })
  async places(@Param('id', id) cycleId: string) {
    const cycle = await this.setup.findCycle(cycleId);
    const taken = await this.setup.placesTaken(cycleId);
    return {
      ...cycleView(cycle),
      grades: cycle.grades.map((grade) => ({
        ...grade,
        taken: taken.get(grade.gradeLevelId) ?? 0,
      })),
    };
  }

  @Get('forms')
  @RequirePermission({ application: ['read'] })
  forms() {
    return this.setup.forms();
  }

  @Put('forms')
  @RequirePermission({ application: ['manage'] })
  saveForm(@Body() dto: FormDto) {
    return this.setup.saveForm(dto);
  }

  @Get('stages')
  @RequirePermission({ application: ['read'] })
  async stages() {
    return (await this.setup.stages()).map(stageView);
  }

  @Put('stages')
  @RequirePermission({ application: ['manage'] })
  saveStages(@Body() { stages }: StagesDto) {
    return this.setup.saveStages(stages);
  }

  // ── The admissions office (ADMS-6, ADMS-7) ──────────────────────────

  @Get('applications')
  @RequirePermission({ application: ['read'] })
  list(@Query() query: ApplicationQueryDto) {
    return this.applications.list(query);
  }

  @Get('applications/:id')
  @RequirePermission({ application: ['read'] })
  get(@Param('id', id) applicationId: string) {
    return this.applications.staffView(applicationId);
  }

  @Post('applications/:id/move')
  @HttpCode(HttpStatus.OK)
  @RequirePermission({ application: ['manage'] })
  move(
    @Param('id', id) applicationId: string,
    @Body() { stageId, offerExpiresOn }: MoveDto,
  ) {
    return this.applications.move(applicationId, stageId, offerExpiresOn);
  }

  @Post('applications/:id/notes')
  @RequirePermission({ application: ['manage'] })
  addNote(@Param('id', id) applicationId: string, @Body() dto: NoteDto) {
    return this.applications.addNote(applicationId, dto);
  }

  // ── Re-enrolment and withdrawals (ADMS-13, ADMS-14) ─────────────────

  @Get('re-enrolments')
  @RequirePermission({ people: ['read'] })
  reEnrolments(@Query() { academicYearId }: ReEnrolmentRunDto) {
    return this.enrolment.reEnrolments(academicYearId);
  }

  @Post('re-enrolments')
  @HttpCode(HttpStatus.OK)
  @RequirePermission({ people: ['manage'] })
  startReEnrolment(@Body() { academicYearId }: ReEnrolmentRunDto) {
    return this.enrolment.startReEnrolment(academicYearId);
  }

  @Post('re-enrolments/apply')
  @HttpCode(HttpStatus.OK)
  @RequirePermission({ people: ['manage'] })
  applyReEnrolment(@Body() { academicYearId }: ReEnrolmentRunDto) {
    return this.enrolment.applyReEnrolment(academicYearId);
  }

  /** Guardians answer for their own children; the service checks the link. */
  @Get('re-enrolments/mine')
  myReEnrolments() {
    return this.enrolment.myReEnrolments();
  }

  @Post('re-enrolments/:id/respond')
  @HttpCode(HttpStatus.OK)
  respondReEnrolment(
    @Param('id', id) entryId: string,
    @Body() { response }: ReEnrolmentResponseDto,
  ) {
    return this.enrolment.respond(entryId, response);
  }

  @Post('students/:id/withdrawal')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ people: ['manage'] })
  withdraw(
    @Param('id', id) studentId: string,
    @Body() { leavingOn, reason }: WithdrawalDto,
  ) {
    return this.enrolment.withdraw(studentId, leavingOn, reason);
  }
}
