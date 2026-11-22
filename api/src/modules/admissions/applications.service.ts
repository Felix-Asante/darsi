import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { Outbox } from '@nestjs/outbox';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In } from 'typeorm';
import { ProblemException } from '../../common/errors/problem.exception.js';
import { RequestContext } from '../../common/tenancy/request-context.js';
import { AcademicsService } from '../academics/academics.service.js';
import { AuditService } from '../audit/audit.service.js';
import { rolesAllow } from '../auth/access-control.js';
import { InvoicesService } from '../billing/invoices.service.js';
import { FilesService, fileView } from '../files/files.service.js';
import type { StoredFile } from '../files/entities/files.entities.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PeopleService } from '../people/people.service.js';
import { SchoolClock } from '../schools/school-clock.service.js';
import { SchoolsService } from '../schools/schools.service.js';
import {
  AdmissionsSetupService,
  stageView,
} from './admissions-setup.service.js';
import type {
  ApplicationDto,
  ApplicationQueryDto,
  NoteDto,
} from './admissions.dto.js';
import {
  AdmissionStage,
  Application,
  ApplicationDocument,
  ApplicationNote,
} from './admissions.entities.js';

export const APPLICANT_ACCEPTED = 'applicant.accepted';

export interface ApplicantAcceptedEvent {
  schoolId: string;
  applicationId: string;
}

/** Stages only someone who decides admissions may move an application into. */
const DECISIONS = new Set(['offered', 'accepted', 'declined', 'waitlisted']);

const problem = (
  status: HttpStatus,
  code: string,
  field?: string,
  fieldCode?: string,
) =>
  new ProblemException(
    status,
    code,
    undefined,
    field ? [{ field, codes: [fieldCode ?? code] }] : undefined,
  );

const fill = (text: string, values: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

/** Applications from draft to decision: the family's side and the admissions office's (ADMS-3–ADMS-10). */
@Injectable()
export class ApplicationsService implements OnModuleInit {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly context: RequestContext,
    private readonly setup: AdmissionsSetupService,
    private readonly academics: AcademicsService,
    private readonly people: PeopleService,
    private readonly files: FilesService,
    private readonly invoices: InvoicesService,
    private readonly notifications: NotificationsService,
    private readonly schools: SchoolsService,
    private readonly audit: AuditService,
    private readonly clock: SchoolClock,
    private readonly outbox: Outbox,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  onModuleInit() {
    this.files.registerUsage('application', {
      assertCanUpload: async (target) => {
        if (!target.applicationId)
          throw problem(
            HttpStatus.BAD_REQUEST,
            'validation_failed',
            'target.applicationId',
            'required',
          );
        const application = await this.own(target.applicationId);
        if (application.status !== 'draft')
          throw problem(HttpStatus.CONFLICT, 'application_submitted');
      },
      canRead: (file) => this.canReadDocument(file),
    });
  }

  private async canReadDocument(file: StoredFile): Promise<boolean> {
    if (rolesAllow(this.context.roles, { application: ['read'] })) return true;
    if (file.uploadedBy === this.context.userId) return true;
    const document = await this.tx.findOneBy(ApplicationDocument, {
      fileId: file.id,
    });
    if (!document) return false;
    return this.tx.existsBy(Application, {
      id: document.applicationId,
      applicantUserId: this.context.requireUserId(),
    });
  }

  // ── The family's side ───────────────────────────────────────────────

  async mine() {
    const applications = await this.tx.find(Application, {
      where: { applicantUserId: this.context.requireUserId() },
      order: { createdAt: 'DESC' },
    });
    return Promise.all(
      applications.map((application) => this.familyView(application)),
    );
  }

  async getOwn(id: string) {
    return this.familyView(await this.own(id));
  }

  async create(dto: ApplicationDto) {
    await this.assertOpen(dto.cycleId, dto.gradeLevelId);
    const user = await this.currentUser();
    const application = await this.tx.save(
      this.tx.create(Application, {
        cycleId: dto.cycleId,
        gradeLevelId: dto.gradeLevelId,
        applicantUserId: user.id,
        status: 'draft',
        stageId: null,
        guardianEmail: user.email,
        locale: user.locale === 'fr' ? 'fr' : 'en',
        answers: {},
      }),
    );
    return this.update(application.id, dto);
  }

  async update(id: string, dto: ApplicationDto) {
    const application = await this.own(id);
    if (application.status !== 'draft')
      throw problem(HttpStatus.CONFLICT, 'application_submitted');
    if (
      dto.cycleId !== application.cycleId ||
      dto.gradeLevelId !== application.gradeLevelId
    ) {
      await this.assertOpen(dto.cycleId, dto.gradeLevelId);
    }
    const form = await this.setup.formForGrade(dto.gradeLevelId);
    // Only the form's own questions are kept, and only valid answers to them.
    const answers: Record<string, string | boolean> = {};
    for (const field of form.fields) {
      const value = dto.answers?.[field.key];
      if (value === undefined || value === null) continue;
      if (field.type === 'checkbox') {
        answers[field.key] = value === true;
        continue;
      }
      const text = String(value).slice(0, 5000);
      if (field.type === 'select' && text && !field.options?.includes(text))
        continue;
      answers[field.key] = text;
    }
    Object.assign(application, {
      cycleId: dto.cycleId,
      gradeLevelId: dto.gradeLevelId,
      studentFirstName: dto.studentFirstName?.trim() || null,
      studentLastName: dto.studentLastName?.trim() || null,
      studentPreferredName: dto.studentPreferredName?.trim() || null,
      studentDateOfBirth: dto.studentDateOfBirth || null,
      guardianFirstName: dto.guardianFirstName?.trim() || null,
      guardianLastName: dto.guardianLastName?.trim() || null,
      guardianPhone: dto.guardianPhone?.trim() || null,
      guardianRelationship: dto.guardianRelationship ?? null,
      answers,
    });
    return this.familyView(await this.tx.save(application));
  }

  async attachDocument(id: string, key: string, fileId: string) {
    const application = await this.own(id);
    if (application.status !== 'draft')
      throw problem(HttpStatus.CONFLICT, 'application_submitted');
    const form = await this.setup.formForGrade(application.gradeLevelId);
    if (!form.documents.some((document) => document.key === key))
      throw new NotFoundException();
    const [file] = await this.files.filesByIds([fileId]);
    if (
      !file ||
      file.purpose !== 'application' ||
      file.uploadedBy !== this.context.requireUserId()
    ) {
      throw problem(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'validation_failed',
        'fileId',
        'notFound',
      );
    }
    const existing = await this.tx.findOneBy(ApplicationDocument, {
      applicationId: id,
      key,
    });
    await this.tx.save(
      existing
        ? Object.assign(existing, { fileId })
        : this.tx.create(ApplicationDocument, {
            applicationId: id,
            key,
            fileId,
          }),
    );
    return this.familyView(application);
  }

  async deleteDraft(id: string) {
    const application = await this.own(id);
    if (application.status !== 'draft')
      throw problem(HttpStatus.CONFLICT, 'application_submitted');
    await this.tx.delete(Application, { id });
  }

  /**
   * Checks everything the school asks for, files the application in the first
   * stage, and bills the application fee to the family (ADMS-4, ADMS-10).
   */
  async submit(id: string) {
    const application = await this.own(id);
    if (application.status !== 'draft')
      throw problem(HttpStatus.CONFLICT, 'application_submitted');
    const cycle = await this.assertOpen(
      application.cycleId,
      application.gradeLevelId,
    );
    const form = await this.setup.formForGrade(application.gradeLevelId);
    const documents = await this.tx.findBy(ApplicationDocument, {
      applicationId: id,
    });
    const missing = [
      ...(
        [
          'studentFirstName',
          'studentLastName',
          'studentDateOfBirth',
          'guardianFirstName',
          'guardianLastName',
          'guardianRelationship',
        ] as const
      ).filter((field) => !application[field]),
      ...form.fields
        .filter((field) => field.required && !application.answers[field.key])
        .map((field) => `answers.${field.key}`),
      ...form.documents
        .filter(
          (document) =>
            document.required &&
            !documents.some((entry) => entry.key === document.key),
        )
        .map((document) => `documents.${document.key}`),
    ];
    if (missing.length) {
      throw new ProblemException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'validation_failed',
        undefined,
        missing.map((field) => ({ field, codes: ['required'] })),
      );
    }

    const { familyId } = await this.people.ensureApplicantFamily({
      userId: application.applicantUserId,
      email: application.guardianEmail,
      firstName: application.guardianFirstName!,
      lastName: application.guardianLastName!,
      phone: application.guardianPhone,
      locale: application.locale,
    });
    const stage = await this.setup.stageOfKind('submitted');
    Object.assign(application, {
      status: 'submitted',
      submittedAt: new Date(),
      stageId: stage.id,
      familyId,
    });
    if (cycle.applicationFee > 0n) {
      application.feeInvoiceId = await this.invoices.issueCharge({
        familyId,
        description: `${application.locale === 'fr' ? 'Frais de candidature' : 'Application fee'} – ${application.studentFirstName} ${application.studentLastName}`,
        amount: cycle.applicationFee,
        reference: cycle.name,
      });
    }
    await this.tx.save(application);
    await this.audit.record({
      action: 'application.submitted',
      entityType: 'application',
      entityId: id,
      after: {
        cycleId: cycle.id,
        gradeLevelId: application.gradeLevelId,
        feeInvoiceId: application.feeInvoiceId,
      },
    });
    return this.familyView(application);
  }

  /** The family accepts or declines an offer before it expires (ADMS-9). */
  async respond(id: string, response: 'accepted' | 'declined') {
    const application = await this.own(id);
    const stage = application.stageId
      ? await this.setup.findStage(application.stageId)
      : null;
    if (stage?.kind !== 'offered' || application.offerResponse)
      throw problem(HttpStatus.CONFLICT, 'no_open_offer');
    if (
      application.offerExpiresOn &&
      application.offerExpiresOn < (await this.clock.today())
    ) {
      throw problem(HttpStatus.CONFLICT, 'offer_expired');
    }
    application.offerResponse = response;
    application.respondedAt = new Date();
    await this.moveTo(
      application,
      await this.setup.stageOfKind(
        response === 'accepted' ? 'accepted' : 'declined',
      ),
    );
    await this.audit.record({
      action: `application.offer_${response}`,
      entityType: 'application',
      entityId: id,
    });
    return this.familyView(application);
  }

  // ── The admissions office ───────────────────────────────────────────

  async list(query: ApplicationQueryDto) {
    const applications = await this.tx.find(Application, {
      where: {
        status: 'submitted',
        ...(query.cycleId ? { cycleId: query.cycleId } : {}),
        ...(query.stageId ? { stageId: query.stageId } : {}),
        ...(query.gradeLevelId ? { gradeLevelId: query.gradeLevelId } : {}),
      },
      order: { submittedAt: 'ASC' },
      take: 1000,
    });
    const [grades, ratings] = await Promise.all([
      this.academics.gradeLevelsByIds(
        applications.map((application) => application.gradeLevelId),
      ),
      applications.length
        ? this.tx.query<
            { application_id: string; rating: string; notes: string }[]
          >(
            `SELECT application_id, avg(rating)::text AS rating, count(*)::text AS notes FROM application_notes WHERE application_id = ANY($1) GROUP BY application_id`,
            [applications.map((application) => application.id)],
          )
        : [],
    ]);
    return applications.map((application) => {
      const notes = ratings.find(
        (row) => row.application_id === application.id,
      );
      return {
        id: application.id,
        cycleId: application.cycleId,
        gradeLevel: {
          id: application.gradeLevelId,
          name:
            grades.find((grade) => grade.id === application.gradeLevelId)
              ?.name ?? '',
        },
        stageId: application.stageId,
        student: {
          firstName: application.studentFirstName,
          lastName: application.studentLastName,
          dateOfBirth: application.studentDateOfBirth,
        },
        guardian: {
          name: `${application.guardianFirstName ?? ''} ${application.guardianLastName ?? ''}`.trim(),
          email: application.guardianEmail,
        },
        submittedAt: application.submittedAt,
        offerExpiresOn: application.offerExpiresOn,
        offerResponse: application.offerResponse,
        studentId: application.studentId,
        notes: Number(notes?.notes ?? 0),
        rating: notes?.rating
          ? Math.round(Number(notes.rating) * 10) / 10
          : null,
      };
    });
  }

  /** Everything the office knows, including staff-only notes (ADMS-7). */
  async staffView(id: string) {
    const application = await this.find(id);
    if (application.status !== 'submitted') throw new NotFoundException();
    const [family, notes] = await Promise.all([
      this.familyView(application),
      this.tx.find(ApplicationNote, {
        where: { applicationId: id },
        order: { createdAt: 'ASC' },
      }),
    ]);
    const authors = await this.tx.query<{ id: string; name: string }[]>(
      `SELECT id, name FROM users WHERE id = ANY($1)`,
      [[...new Set(notes.map((note) => note.authorId))]],
    );
    return {
      ...family,
      guardianEmail: application.guardianEmail,
      familyId: application.familyId,
      studentId: application.studentId,
      notes: notes.map((note) => ({
        id: note.id,
        kind: note.kind,
        body: note.body,
        rating: note.rating,
        author:
          authors.find((author) => author.id === note.authorId)?.name ?? '',
        createdAt: note.createdAt,
      })),
    };
  }

  async addNote(id: string, dto: NoteDto) {
    await this.staffView(id);
    if (dto.kind === 'rating' && !dto.rating)
      throw problem(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'validation_failed',
        'rating',
        'required',
      );
    await this.tx.save(
      this.tx.create(ApplicationNote, {
        applicationId: id,
        authorId: this.context.requireUserId(),
        kind: dto.kind,
        body: dto.body.trim(),
        rating: dto.kind === 'rating' ? dto.rating! : null,
      }),
    );
    return this.staffView(id);
  }

  /** Moves an application along the pipeline; the stage's email goes to the family (ADMS-6, ADMS-8, ADMS-9). */
  async move(id: string, stageId: string, offerExpiresOn?: string) {
    const application = await this.find(id);
    if (application.status !== 'submitted') throw new NotFoundException();
    const stage = await this.setup.findStage(stageId);
    if (
      DECISIONS.has(stage.kind) &&
      !rolesAllow(this.context.roles, { application: ['decide'] })
    )
      throw new ForbiddenException();
    if (stage.kind === 'enrolled' || application.studentId)
      throw problem(HttpStatus.CONFLICT, 'enrolment_automatic');
    if (stage.kind === 'offered') {
      const today = await this.clock.today();
      if (!offerExpiresOn || offerExpiresOn < today) {
        throw problem(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'validation_failed',
          'offerExpiresOn',
          offerExpiresOn ? 'min' : 'required',
        );
      }
      const cycle = await this.setup.findCycle(application.cycleId);
      const places =
        cycle.grades.find(
          (grade) => grade.gradeLevelId === application.gradeLevelId,
        )?.places ?? 0;
      const taken =
        (await this.setup.placesTaken(cycle.id)).get(
          application.gradeLevelId,
        ) ?? 0;
      const current = application.stageId
        ? await this.setup.findStage(application.stageId)
        : null;
      const alreadyCounted =
        current && ['offered', 'accepted', 'enrolled'].includes(current.kind);
      if (!alreadyCounted && taken >= places)
        throw problem(HttpStatus.CONFLICT, 'no_places_left');
      application.offerExpiresOn = offerExpiresOn;
      application.offerResponse = null;
      application.respondedAt = null;
    }
    await this.moveTo(application, stage);
    return this.staffView(id);
  }

  private async moveTo(application: Application, stage: AdmissionStage) {
    const before = application.stageId;
    application.stageId = stage.id;
    await this.tx.save(application);
    await this.audit.record({
      action: 'application.stage_changed',
      entityType: 'application',
      entityId: application.id,
      before: { stageId: before },
      after: { stageId: stage.id, kind: stage.kind },
    });
    if (stage.kind === 'accepted') {
      const event: ApplicantAcceptedEvent = {
        schoolId: this.context.requireSchoolId(),
        applicationId: application.id,
      };
      await this.outbox.add(this.tx, {
        topic: APPLICANT_ACCEPTED,
        payload: event,
      });
    }
    if (stage.email) await this.emailFamily(application, stage);
  }

  private async emailFamily(application: Application, stage: AdmissionStage) {
    const copy =
      (application.locale === 'fr' && stage.email!.fr) || stage.email!.en;
    const school = await this.schools.getCurrent();
    const locale = application.locale === 'fr' ? 'fr-FR' : 'en-GB';
    const values = {
      student:
        `${application.studentFirstName ?? ''} ${application.studentLastName ?? ''}`.trim(),
      school: school.name,
      expires: application.offerExpiresOn
        ? new Intl.DateTimeFormat(locale, {
            dateStyle: 'long',
            timeZone: 'UTC',
          }).format(new Date(`${application.offerExpiresOn}T00:00:00Z`))
        : '',
    };
    await this.notifications.deliver({
      userIds: [application.applicantUserId],
      type: 'admission.update',
      params: { stage: stage.name },
      link: '/applications',
      locales: new Map([[application.applicantUserId, application.locale]]),
      mail: (url) => ({
        type: 'admission.update',
        url,
        params: {
          subject: fill(copy.subject, values),
          body: fill(copy.body, values),
        },
      }),
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  /** What the family sees: never staff notes or ratings. */
  private async familyView(application: Application) {
    const [cycle, stage, form, documents, grade] = await Promise.all([
      this.setup.findCycle(application.cycleId),
      application.stageId ? this.setup.findStage(application.stageId) : null,
      this.setup.formForGrade(application.gradeLevelId),
      this.tx.findBy(ApplicationDocument, { applicationId: application.id }),
      this.academics.findGradeLevel(application.gradeLevelId),
    ]);
    const files = await this.files.filesByIds(
      documents.map((document) => document.fileId),
    );
    return {
      id: application.id,
      status: application.status,
      cycle: {
        id: cycle.id,
        name: cycle.name,
        applicationFee: cycle.applicationFee.toString(),
      },
      gradeLevel: { id: grade.id, name: grade.name },
      stage: stage ? stageView(stage) : null,
      student: {
        firstName: application.studentFirstName,
        lastName: application.studentLastName,
        preferredName: application.studentPreferredName,
        dateOfBirth: application.studentDateOfBirth,
      },
      guardian: {
        firstName: application.guardianFirstName,
        lastName: application.guardianLastName,
        phone: application.guardianPhone,
        relationship: application.guardianRelationship,
      },
      answers: application.answers,
      form: { fields: form.fields, documents: form.documents },
      documents: documents.flatMap((document) => {
        const file = files.find((entry) => entry.id === document.fileId);
        return file ? [{ key: document.key, file: fileView(file) }] : [];
      }),
      submittedAt: application.submittedAt,
      feeInvoiceId: application.feeInvoiceId,
      offer:
        stage?.kind === 'offered' || application.offerResponse
          ? {
              expiresOn: application.offerExpiresOn,
              response: application.offerResponse,
            }
          : null,
    };
  }

  private async assertOpen(cycleId: string, gradeLevelId: string) {
    const cycle = await this.setup.findCycle(cycleId).catch(() => {
      throw problem(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'validation_failed',
        'cycleId',
        'notFound',
      );
    });
    const today = await this.clock.today();
    if (cycle.opensOn > today || cycle.closesOn < today)
      throw problem(HttpStatus.CONFLICT, 'cycle_closed');
    if (!cycle.grades.some((grade) => grade.gradeLevelId === gradeLevelId)) {
      throw problem(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'validation_failed',
        'gradeLevelId',
        'notFound',
      );
    }
    return cycle;
  }

  private async own(id: string): Promise<Application> {
    const application = await this.find(id);
    if (application.applicantUserId !== this.context.requireUserId())
      throw new NotFoundException();
    return application;
  }

  async find(id: string): Promise<Application> {
    const application = await this.tx.findOneBy(Application, { id });
    if (!application) throw new NotFoundException();
    return application;
  }

  async openApplicationsOf(userId: string, except: string) {
    const rows = await this.tx.find(Application, {
      where: { applicantUserId: userId },
      select: { id: true, studentId: true, stageId: true },
    });
    const stages = await this.tx.findBy(AdmissionStage, {
      id: In(rows.flatMap((row) => (row.stageId ? [row.stageId] : []))),
    });
    return rows.filter(
      (row) =>
        row.id !== except &&
        !row.studentId &&
        !['declined', 'withdrawn', 'enrolled'].includes(
          stages.find((stage) => stage.id === row.stageId)?.kind ?? '',
        ),
    ).length;
  }

  private async currentUser() {
    const [user] = await this.tx.query<
      { id: string; email: string; locale: string | null }[]
    >(`SELECT id, email, locale FROM users WHERE id = $1`, [
      this.context.requireUserId(),
    ]);
    if (!user) throw new ForbiddenException();
    return user;
  }
}
