import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OnOutboxMessage } from '@nestjs/outbox';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In } from 'typeorm';
import { ProblemException } from '../../common/errors/problem.exception.js';
import { RequestContext } from '../../common/tenancy/request-context.js';
import { TenantTransactions } from '../../common/tenancy/tenant-transactions.js';
import { AcademicsService } from '../academics/academics.service.js';
import { AuditService } from '../audit/audit.service.js';
import { BillingSetupService } from '../billing/billing-setup.service.js';
import { InvoicesService } from '../billing/invoices.service.js';
import { FilesService } from '../files/files.service.js';
import { PeopleService } from '../people/people.service.js';
import { AdmissionsSetupService } from './admissions-setup.service.js';
import {
  Application,
  ApplicationDocument,
  ReEnrolment,
} from './admissions.entities.js';
import {
  APPLICANT_ACCEPTED,
  type ApplicantAcceptedEvent,
  ApplicationsService,
} from './applications.service.js';
import { MembershipService } from './membership.service.js';

/** Each grade's next grade, in division then grade order; the last grade has none. */
export function nextGrades(
  divisions: { gradeLevels: { id: string }[] }[],
): Map<string, string | null> {
  const ordered = divisions.flatMap((division) =>
    division.gradeLevels.map((grade) => grade.id),
  );
  return new Map(ordered.map((id, index) => [id, ordered[index + 1] ?? null]));
}

/** From accepted applicant to enrolled student, and from one year to the next (ADMS-11–ADMS-14). */
@Injectable()
export class EnrolmentService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly context: RequestContext,
    private readonly transactions: TenantTransactions,
    private readonly setup: AdmissionsSetupService,
    private readonly applications: ApplicationsService,
    private readonly membership: MembershipService,
    private readonly academics: AcademicsService,
    private readonly people: PeopleService,
    private readonly files: FilesService,
    private readonly billingSetup: BillingSetupService,
    private readonly invoices: InvoicesService,
    private readonly audit: AuditService,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  /**
   * Runs once per accepted application, in one transaction: the student, the
   * family link, the documents and the deposit invoice. A retried event finds
   * the student already there and does nothing.
   */
  @OnOutboxMessage(APPLICANT_ACCEPTED, { consumer: 'admissions-enrolment' })
  async onAccepted({ schoolId, applicationId }: ApplicantAcceptedEvent) {
    await this.transactions.runInSchool(schoolId, () =>
      this.enrol(schoolId, applicationId),
    );
  }

  private async enrol(schoolId: string, applicationId: string) {
    const application = await this.tx.findOne(Application, {
      where: { id: applicationId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!application || application.studentId) return;

    const { guardianId, familyId } = await this.people.ensureApplicantFamily({
      userId: application.applicantUserId,
      email: application.guardianEmail,
      firstName: application.guardianFirstName!,
      lastName: application.guardianLastName!,
      phone: application.guardianPhone,
      locale: application.locale,
    });
    const student = await this.people.admitStudent({
      studentNumber: `A-${application.id.replace(/-/g, '').slice(-8).toUpperCase()}`,
      firstName: application.studentFirstName!,
      lastName: application.studentLastName!,
      preferredName: application.studentPreferredName,
      dateOfBirth: application.studentDateOfBirth,
      gradeLevelId: application.gradeLevelId,
      guardianId,
      relationship: application.guardianRelationship ?? 'parent',
    });

    const form = await this.setup.formForGrade(application.gradeLevelId);
    for (const document of await this.tx.findBy(ApplicationDocument, {
      applicationId,
    })) {
      const label = form.documents.find(
        (entry) => entry.key === document.key,
      )?.label;
      await this.files.adoptAsStudentFile(
        document.fileId,
        student.id,
        (application.locale === 'fr' && label?.fr) || label?.en || document.key,
      );
    }

    const cycle = await this.setup.findCycle(application.cycleId);
    const deposit = cycle.depositFeeItemId
      ? await this.billingSetup.findFeeItem(cycle.depositFeeItemId)
      : null;
    if (deposit && deposit.amount > 0n) {
      await this.invoices.issueCharge({
        familyId,
        description: deposit.name,
        amount: deposit.amount,
        taxRateBp: deposit.taxRateBp,
        feeItemId: deposit.id,
        studentId: student.id,
        reference: cycle.name,
      });
    }

    application.studentId = student.id;
    application.familyId = familyId;
    application.stageId = (await this.setup.stageOfKind('enrolled')).id;
    await this.tx.save(application);
    await this.membership.makeGuardian(
      schoolId,
      application.applicantUserId,
      (await this.applications.openApplicationsOf(
        application.applicantUserId,
        applicationId,
      )) > 0,
    );
    await this.audit.record({
      action: 'application.enrolled',
      entityType: 'application',
      entityId: applicationId,
      after: { studentId: student.id, familyId, deposit: deposit?.id ?? null },
    });
  }

  // ── Re-enrolment (ADMS-13) ──────────────────────────────────────────

  /** Asks every family to confirm each child's place next year, one grade up. */
  async startReEnrolment(academicYearId: string) {
    const year = await this.academics.findYear(academicYearId);
    const current = await this.academics.currentYear();
    if (current && year.startsOn <= current.startsOn)
      throw new ProblemException(
        HttpStatus.CONFLICT,
        'not_a_future_year',
        'Choose next year',
      );
    const next = nextGrades(await this.academics.listDivisions());
    const students = await this.people.billableStudents();
    const existing = new Set(
      (await this.tx.findBy(ReEnrolment, { academicYearId })).map(
        (entry) => entry.studentId,
      ),
    );
    const created = students
      .filter((student) => !existing.has(student.id) && student.gradeLevelId)
      .map((student) =>
        this.tx.create(ReEnrolment, {
          studentId: student.id,
          academicYearId,
          gradeLevelId: next.get(student.gradeLevelId!) ?? null,
          status: 'pending' as const,
        }),
      );
    if (created.length) await this.tx.save(created, { chunk: 200 });
    await this.audit.record({
      action: 're_enrolment.started',
      entityType: 'academic_year',
      entityId: academicYearId,
      after: { students: created.length },
    });
    return {
      created: created.length,
      skipped: students.length - created.length,
    };
  }

  async reEnrolments(academicYearId: string) {
    const entries = await this.tx.find(ReEnrolment, {
      where: { academicYearId },
      order: { createdAt: 'ASC' },
    });
    return this.views(entries);
  }

  /** What the signed-in guardian still has to answer. */
  async myReEnrolments() {
    const studentIds = await this.people.guardedStudentIds(
      this.context.requireUserId(),
    );
    if (studentIds.length === 0) return [];
    return this.views(
      await this.tx.findBy(ReEnrolment, { studentId: In(studentIds) }),
    );
  }

  async respond(id: string, response: 'confirmed' | 'declined') {
    const entry = await this.tx.findOneBy(ReEnrolment, { id });
    if (!entry) throw new NotFoundException();
    if (
      !(
        await this.people.guardedStudentIds(this.context.requireUserId())
      ).includes(entry.studentId)
    )
      throw new ForbiddenException();
    if (entry.status !== 'pending')
      throw new ProblemException(
        HttpStatus.CONFLICT,
        'already_answered',
        'Already answered',
      );
    Object.assign(entry, {
      status: response,
      respondedBy: this.context.requireUserId(),
      respondedAt: new Date(),
    });
    await this.tx.save(entry);
    await this.audit.record({
      action: `re_enrolment.${response}`,
      entityType: 'student',
      entityId: entry.studentId,
      after: { academicYearId: entry.academicYearId },
    });
    return (await this.views([entry]))[0];
  }

  /** When the new year starts: confirmed students move up a grade. */
  async applyReEnrolment(academicYearId: string) {
    const confirmed = await this.tx.findBy(ReEnrolment, {
      academicYearId,
      status: 'confirmed',
    });
    for (const entry of confirmed) {
      if (entry.gradeLevelId)
        await this.people.setGradeLevel(entry.studentId, entry.gradeLevelId);
      entry.status = 'applied';
    }
    if (confirmed.length) await this.tx.save(confirmed);
    await this.audit.record({
      action: 're_enrolment.applied',
      entityType: 'academic_year',
      entityId: academicYearId,
      after: { students: confirmed.length },
    });
    return { applied: confirmed.length };
  }

  // ── Withdrawals (ADMS-14) ───────────────────────────────────────────

  async withdraw(studentId: string, leavingOn: string, reason: string) {
    await this.people.withdraw(studentId, leavingOn, reason);
  }

  private async views(entries: ReEnrolment[]) {
    const [students, grades] = await Promise.all([
      this.people.studentsByIds(entries.map((entry) => entry.studentId)),
      this.academics.gradeLevelsByIds(
        entries.map((entry) => entry.gradeLevelId),
      ),
    ]);
    return entries.map((entry) => {
      const student = students.find(
        (candidate) => candidate.id === entry.studentId,
      );
      return {
        id: entry.id,
        academicYearId: entry.academicYearId,
        student: student
          ? {
              id: student.id,
              name: `${student.preferredName ?? student.firstName} ${student.lastName}`,
              gradeLevel: student.gradeLevel,
            }
          : null,
        nextGradeLevel: entry.gradeLevelId
          ? {
              id: entry.gradeLevelId,
              name:
                grades.find((grade) => grade.id === entry.gradeLevelId)?.name ??
                '',
            }
          : null,
        status: entry.status,
        respondedAt: entry.respondedAt,
      };
    });
  }
}
