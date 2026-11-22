import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { ProblemException } from '../../common/errors/problem.exception.js';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { addDays } from '../../common/dates/calendar-date.js';
import { AssessmentsService } from '../assessment/assessments.service.js';
import { AttendanceService } from '../attendance/attendance.service.js';
import { AuditService } from '../audit/audit.service.js';
import { FilesService } from '../files/files.service.js';
import { PeopleService } from '../people/people.service.js';
import { PortfolioService } from '../portfolio/portfolio.service.js';
import { SchoolClock } from '../schools/school-clock.service.js';

/** How far back an export reads attendance; older records are covered by retention. */
const ATTENDANCE_DAYS = 400;

/**
 * A student's data on request: everything the school holds about them, as
 * one document, and erasure that removes it from every module.
 */
@Injectable()
export class PrivacyService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly people: PeopleService,
    private readonly assessments: AssessmentsService,
    private readonly attendance: AttendanceService,
    private readonly files: FilesService,
    private readonly portfolio: PortfolioService,
    private readonly audit: AuditService,
    private readonly clock: SchoolClock,
  ) {}

  async export(studentId: string) {
    const profile = await this.people.getStudent(studentId);
    const today = await this.clock.today();
    const items = [];
    let cursor: string | undefined;
    do {
      const page = await this.portfolio.items(studentId, cursor);
      items.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);

    const bundle = {
      exportedAt: new Date().toISOString(),
      student: profile,
      grades: await this.assessments.studentGrades(studentId),
      attendance: await this.attendance.studentSummary(
        studentId,
        addDays(today, -ATTENDANCE_DAYS),
        today,
      ),
      portfolio: items,
      files: await this.files.studentFiles(studentId),
    };
    await this.audit.record({
      action: 'student.exported',
      entityType: 'student',
      entityId: studentId,
    });
    return bundle;
  }

  /**
   * Deletes the student and everything that hangs off them (enrolments, grades,
   * attendance, portfolio, reports, files), then guardians left with no child.
   * The audit log keeps only the fact and the id.
   */
  async erase(studentId: string): Promise<void> {
    const tx = this.txHost.tx;
    const [exists] = await tx.query<{ id: string }[]>(
      `SELECT id FROM students WHERE id = $1`,
      [studentId],
    );
    if (!exists) throw new NotFoundException();
    // Invoices must be kept for accounting, so a student on an issued one can't be erased yet.
    const [billed] = await tx.query<{ id: string }[]>(
      `SELECT l.id FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id WHERE l.student_id = $1 AND i.status = 'issued' LIMIT 1`,
      [studentId],
    );
    if (billed) {
      throw new ProblemException(
        HttpStatus.CONFLICT,
        'has_financial_records',
        'The student appears on issued invoices',
      );
    }
    const fileIds = (
      await tx.query<{ id: string }[]>(
        `SELECT file_id AS id FROM student_files WHERE student_id = $1
         UNION SELECT file_id FROM submissions WHERE student_id = $1 AND file_id IS NOT NULL
         UNION SELECT file_id FROM portfolio_items WHERE student_id = $1 AND file_id IS NOT NULL`,
        [studentId],
      )
    ).map((row) => row.id);
    const guardianIds = (
      await tx.query<{ guardian_id: string }[]>(
        `SELECT guardian_id FROM guardian_links WHERE student_id = $1`,
        [studentId],
      )
    ).map((row) => row.guardian_id);

    await this.people.deleteStudent(studentId);
    await this.people.deleteGuardiansWithoutStudents(guardianIds);
    await this.files.deleteFiles(fileIds);
    await this.audit.record({
      action: 'student.erased',
      entityType: 'student',
      entityId: studentId,
    });
  }
}
