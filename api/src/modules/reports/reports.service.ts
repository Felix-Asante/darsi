import { InjectQueue } from '@nestjs/bullmq';
import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import type { Queue } from 'bullmq';
import { In, IsNull } from 'typeorm';
import { ProblemException } from '../../common/errors/problem.exception.js';
import { RequestContext } from '../../common/tenancy/request-context.js';
import { TenantTransactions } from '../../common/tenancy/tenant-transactions.js';
import { AcademicsService } from '../academics/academics.service.js';
import { AssessmentsService } from '../assessment/assessments.service.js';
import { AttendanceService } from '../attendance/attendance.service.js';
import { AuditService } from '../audit/audit.service.js';
import { rolesAllow } from '../auth/access-control.js';
import { FilesService } from '../files/files.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PeopleService } from '../people/people.service.js';
import { PolicyService } from '../policies/policy.service.js';
import { SchoolClock } from '../schools/school-clock.service.js';
import { SchoolsService } from '../schools/schools.service.js';
import { DocumentRenderer } from '../documents/document-renderer.service.js';
import type { OpenReportsDto, ReportTemplateDto } from './report.dto.js';
import {
  ReportCard,
  ReportEntry,
  type ReportStatus,
  ReportTemplate,
} from './report.entities.js';
import { renderReportHtml } from './report-html.js';

export const DOCUMENTS_QUEUE = 'documents';

export interface GenerateReportJob {
  schoolId: string;
  cardId: string;
}

/** Teachers write comments only while the report is with them. */
const EDITABLE: ReportStatus[] = ['draft', 'returned'];

const locked = () =>
  new ProblemException(
    HttpStatus.CONFLICT,
    'report_locked',
    'This report is no longer being edited',
  );

@Injectable()
export class ReportsService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly context: RequestContext,
    private readonly transactions: TenantTransactions,
    private readonly policy: PolicyService,
    private readonly academics: AcademicsService,
    private readonly people: PeopleService,
    private readonly assessments: AssessmentsService,
    private readonly attendance: AttendanceService,
    private readonly files: FilesService,
    private readonly schools: SchoolsService,
    private readonly notifications: NotificationsService,
    private readonly renderer: DocumentRenderer,
    private readonly audit: AuditService,
    private readonly clock: SchoolClock,
    @InjectQueue(DOCUMENTS_QUEUE)
    private readonly queue: Queue<GenerateReportJob>,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  // ── Templates (RPT-1) ───────────────────────────────────────────────

  listTemplates() {
    return this.tx.find(ReportTemplate, { order: { name: 'ASC' } });
  }

  async saveTemplate(dto: ReportTemplateDto) {
    if (dto.divisionId) await this.academics.findDivision(dto.divisionId);
    const template =
      (await this.tx.findOneBy(ReportTemplate, {
        divisionId: dto.divisionId ?? IsNull(),
      })) ?? this.tx.create(ReportTemplate, {});
    return this.tx.save(
      Object.assign(template, {
        divisionId: dto.divisionId ?? null,
        name: dto.name,
        subjectIds: [...new Set(dto.subjectIds)],
        includeAttendance: dto.includeAttendance,
        includeGeneralComment: dto.includeGeneralComment,
      }),
    );
  }

  // ── Opening a term ──────────────────────────────────────────────────

  /**
   * Creates a draft report for every active student (of a division, or of the
   * school) with one entry per class they take this year. Running it again only
   * adds what is missing, such as a student who joined since.
   */
  async open(termId: string, { divisionId, locale }: OpenReportsDto) {
    const term = await this.academics.findTerm(termId);
    const gradeLevelIds = divisionId
      ? await this.academics.gradeLevelIdsInDivision(divisionId)
      : [];
    const studentIds = divisionId
      ? await this.people.studentIdsIn({ gradeLevelIds })
      : (
          await this.tx.query<{ id: string }[]>(
            `SELECT id FROM students WHERE status = 'active'`,
          )
        ).map((row) => row.id);
    const templates = await this.listTemplates();
    const templateFor = (
      gradeLevelId: string | null,
      levels: { id: string; divisionId: string }[],
    ) => {
      const division = levels.find(
        (level) => level.id === gradeLevelId,
      )?.divisionId;
      return (
        templates.find((template) => template.divisionId === division) ??
        templates.find((template) => template.divisionId === null)
      );
    };
    const students = await this.people.studentsByIds(studentIds);
    const levels = await this.academics.gradeLevelsByIds(
      students.map((student) => student.gradeLevel?.id ?? null),
    );
    const school = await this.schools.getCurrent();
    let created = 0;

    for (const student of students) {
      const template = templateFor(student.gradeLevel?.id ?? null, levels);
      if (!template)
        throw new ProblemException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'no_report_template',
          'Add a report template first',
        );
      const card =
        (await this.tx.findOneBy(ReportCard, {
          termId,
          studentId: student.id,
        })) ??
        (await this.tx.save(
          this.tx.create(ReportCard, {
            termId,
            studentId: student.id,
            templateId: template.id,
            status: 'draft',
            locale: locale ?? (school.defaultLocale === 'fr' ? 'fr' : 'en'),
          }),
        ));
      if (!EDITABLE.includes(card.status)) continue;
      const classes = (
        await this.academics.findClassesByIds(
          await this.people.currentClassIds(student.id),
        )
      ).filter(
        (schoolClass) =>
          schoolClass.academicYearId === term.academicYearId &&
          (template.subjectIds.length === 0 ||
            (schoolClass.subject &&
              template.subjectIds.includes(schoolClass.subject.id))),
      );
      const existing = await this.tx.findBy(ReportEntry, { cardId: card.id });
      for (const schoolClass of classes.filter(
        (entry) => !existing.some((row) => row.classId === entry.id),
      )) {
        await this.tx.save(
          this.tx.create(ReportEntry, {
            cardId: card.id,
            classId: schoolClass.id,
            subjectName: schoolClass.subject?.name ?? schoolClass.name,
          }),
        );
        created += 1;
      }
    }
    return { students: students.length, entriesAdded: created };
  }

  // ── Teachers (RPT-2) ────────────────────────────────────────────────

  /** A class's reports for the term, with each student's result from the gradebook as it stands. */
  async classSheet(classId: string, termId: string) {
    await this.policy.assertClassAccess(classId, [
      'teacher',
      'teaching_assistant',
    ]);
    const cards = await this.tx.findBy(ReportCard, { termId });
    const entries = cards.length
      ? await this.tx.findBy(ReportEntry, {
          classId,
          cardId: In(cards.map((card) => card.id)),
        })
      : [];
    const book = await this.assessments.gradebook(classId, termId);
    const students = await this.people.studentsByIds(
      entries.map(
        (entry) => cards.find((card) => card.id === entry.cardId)!.studentId,
      ),
    );
    return {
      reportingScale: book.reportingScale
        ? { id: book.reportingScale.id, name: book.reportingScale.name }
        : null,
      rows: entries
        .map((entry) => {
          const card = cards.find(
            (candidate) => candidate.id === entry.cardId,
          )!;
          const student = students.find(
            (candidate) => candidate.id === card.studentId,
          )!;
          const live = book.results.find(
            (result) => result.studentId === card.studentId,
          );
          return {
            student,
            status: card.status,
            returnNote: card.status === 'returned' ? card.returnNote : null,
            result: EDITABLE.includes(card.status)
              ? (live?.value ?? null)
              : entry.resultValue,
            comment: entry.comment,
          };
        })
        .sort(
          (a, b) =>
            a.student.lastName.localeCompare(b.student.lastName) ||
            a.student.firstName.localeCompare(b.student.firstName),
        ),
    };
  }

  async saveComments(
    classId: string,
    termId: string,
    comments: { studentId: string; comment?: string | null }[],
  ) {
    await this.policy.assertClassAccess(classId, [
      'teacher',
      'teaching_assistant',
    ]);
    const userId = this.context.requireUserId();
    for (const { studentId, comment } of comments) {
      const card = await this.tx.findOneBy(ReportCard, { termId, studentId });
      const entry =
        card &&
        (await this.tx.findOneBy(ReportEntry, { cardId: card.id, classId }));
      if (!card || !entry) throw new NotFoundException();
      if (!EDITABLE.includes(card.status)) throw locked();
      Object.assign(entry, {
        comment: comment?.trim() || null,
        commentBy: userId,
      });
      await this.tx.save(entry);
    }
    return this.classSheet(classId, termId);
  }

  // ── Review (RPT-4) ──────────────────────────────────────────────────

  async reviewList(termId: string) {
    this.assertReviewer();
    const cards = await this.tx.find(ReportCard, { where: { termId } });
    const entries = cards.length
      ? await this.tx.findBy(ReportEntry, {
          cardId: In(cards.map((card) => card.id)),
        })
      : [];
    const students = await this.people.studentsByIds(
      cards.map((card) => card.studentId),
    );
    return cards
      .map((card) => {
        const own = entries.filter((entry) => entry.cardId === card.id);
        return {
          id: card.id,
          status: card.status,
          student: students.find((student) => student.id === card.studentId)!,
          entries: own.length,
          commented: own.filter((entry) => entry.comment).length,
          fileId: card.fileId,
        };
      })
      .filter((card) => card.student)
      .sort((a, b) => a.student.lastName.localeCompare(b.student.lastName));
  }

  async card(id: string) {
    const card = await this.find(id);
    const reviewer =
      rolesAllow(this.context.roles, { report: ['approve'] }) ||
      rolesAllow(this.context.roles, { report: ['manage'] });
    if (!reviewer) {
      await this.policy.assertStudentAccess(card.studentId);
      if (
        card.status !== 'published' &&
        !rolesAllow(this.context.roles, { report: ['comment'] })
      )
        throw new ForbiddenException();
    }
    const [student] = await this.people.studentsByIds([card.studentId]);
    const entries = await this.tx.findBy(ReportEntry, { cardId: id });
    const term = await this.academics.findTerm(card.termId);
    return {
      id: card.id,
      status: card.status,
      locale: card.locale,
      generalComment: card.generalComment,
      returnNote: card.returnNote,
      attendance: card.attendance,
      fileId: card.fileId,
      publishedAt: card.publishedAt,
      term: {
        id: term.id,
        name: term.name,
        startsOn: term.startsOn,
        endsOn: term.endsOn,
      },
      student,
      entries: entries
        .map(
          ({
            id: entryId,
            classId,
            subjectName,
            resultValue,
            reportingScaleName,
            comment,
          }) => ({
            id: entryId,
            classId,
            subjectName,
            resultValue,
            reportingScaleName,
            comment,
          }),
        )
        .sort((a, b) =>
          (a.subjectName ?? '').localeCompare(b.subjectName ?? ''),
        ),
    };
  }

  async setGeneralComment(id: string, generalComment: string | null) {
    this.assertReviewer();
    const card = await this.find(id);
    if (!EDITABLE.includes(card.status)) throw locked();
    card.generalComment = generalComment?.trim() || null;
    await this.tx.save(card);
    return this.card(id);
  }

  async returnForEdits(id: string, note: string) {
    this.assertReviewer();
    const card = await this.find(id);
    if (card.status !== 'draft' && card.status !== 'returned') throw locked();
    Object.assign(card, { status: 'returned', returnNote: note });
    await this.tx.save(card);
    await this.audit.record({
      action: 'report.returned',
      entityType: 'report_card',
      entityId: id,
      after: { note },
    });
    return this.card(id);
  }

  /**
   * Fixes each subject's result and the term's attendance as they are now, then
   * queues the PDF. Later grade changes don't alter an approved report.
   */
  async approve(id: string) {
    this.assertReviewer();
    const card = await this.find(id);
    if (!EDITABLE.includes(card.status)) throw locked();
    const term = await this.academics.findTerm(card.termId);
    const template = card.templateId
      ? await this.tx.findOneBy(ReportTemplate, { id: card.templateId })
      : null;
    for (const entry of await this.tx.findBy(ReportEntry, { cardId: id })) {
      const book = await this.assessments.gradebook(entry.classId, card.termId);
      const result = book.results.find(
        (row) => row.studentId === card.studentId,
      );
      Object.assign(entry, {
        resultValue: result?.value ?? null,
        reportingScaleName: book.reportingScale?.name ?? null,
      });
      await this.tx.save(entry);
    }
    if (template?.includeAttendance ?? true) {
      const { rate, sessions, absent, late } =
        await this.attendance.studentSummary(
          card.studentId,
          term.startsOn,
          term.endsOn,
        );
      card.attendance = { rate, sessions, absent, late };
    }
    Object.assign(card, {
      status: 'approved',
      approvedBy: this.context.requireUserId(),
      approvedAt: new Date(),
    });
    await this.tx.save(card);
    await this.audit.record({
      action: 'report.approved',
      entityType: 'report_card',
      entityId: id,
    });
    await this.queue.add(
      'generate',
      { schoolId: this.context.requireSchoolId(), cardId: id },
      { jobId: `report-${id}` },
    );
    return this.card(id);
  }

  /** Runs in the worker: renders the PDF, files it on the student's record and tells the family (RPT-5/6). */
  async generate({ schoolId, cardId }: GenerateReportJob): Promise<boolean> {
    return this.transactions.runInSchool(schoolId, async () => {
      const card = await this.tx.findOneBy(ReportCard, { id: cardId });
      if (!card || card.status !== 'approved') return false;
      const [student] = await this.people.studentsByIds([card.studentId]);
      const [term, school, entries, today] = await Promise.all([
        this.academics.findTerm(card.termId),
        this.schools.getCurrent(),
        this.tx.findBy(ReportEntry, { cardId }),
        this.clock.today(),
      ]);
      const template = card.templateId
        ? await this.tx.findOneBy(ReportTemplate, { id: card.templateId })
        : null;
      const name = `${student.preferredName ?? student.firstName} ${student.lastName}`;
      const pdf = await this.renderer.pdf(
        renderReportHtml({
          locale: card.locale,
          schoolName: school.name,
          termName: term.name,
          termDates: { from: term.startsOn, to: term.endsOn },
          student: {
            name,
            number: student.studentNumber,
            grade: student.gradeLevel?.name ?? null,
          },
          entries: entries
            .map((entry) => ({
              subject: entry.subjectName ?? '',
              result: entry.resultValue,
              scale: entry.reportingScaleName,
              comment: entry.comment,
            }))
            .sort((a, b) => a.subject.localeCompare(b.subject)),
          attendance:
            template?.includeAttendance === false ? null : card.attendance,
          generalComment:
            template?.includeGeneralComment === false
              ? null
              : card.generalComment,
          issuedOn: today,
        }),
      );
      const title =
        card.locale === 'fr'
          ? `Bulletin – ${term.name}`
          : `Report – ${term.name}`;
      const file = await this.files.storeStudentDocument(
        card.studentId,
        `${title} – ${name}.pdf`,
        title,
        pdf,
        'application/pdf',
      );
      Object.assign(card, {
        status: 'published',
        fileId: file.id,
        publishedAt: new Date(),
      });
      await this.tx.save(card);

      const recipients = await this.people.accountUserIds([card.studentId]);
      const guardians = await this.people.guardianLocales(
        recipients.get(card.studentId) ?? [],
      );
      await this.notifications.deliver({
        userIds: recipients.get(card.studentId) ?? [],
        type: 'report.published',
        params: { student: name, term: term.name },
        link: `/portfolio/${card.studentId}`,
        locales: guardians,
        mail: (url) => ({
          type: 'report.published',
          url,
          params: { student: name, term: term.name },
        }),
      });
      return true;
    });
  }

  /** Published reports, for the portfolio. */
  async published(studentId: string) {
    const cards = await this.tx.find(ReportCard, {
      where: { studentId, status: 'published' },
      order: { publishedAt: 'DESC' },
    });
    const terms = await Promise.all(
      cards.map((card) => this.academics.findTerm(card.termId)),
    );
    return cards.map((card, index) => ({
      id: card.id,
      term: terms[index].name,
      fileId: card.fileId,
      publishedAt: card.publishedAt,
    }));
  }

  private assertReviewer() {
    if (
      !rolesAllow(this.context.roles, { report: ['approve'] }) &&
      !rolesAllow(this.context.roles, { report: ['manage'] })
    ) {
      throw new ForbiddenException();
    }
  }

  private async find(id: string): Promise<ReportCard> {
    const card = await this.tx.findOneBy(ReportCard, { id });
    if (!card) throw new NotFoundException();
    return card;
  }
}
