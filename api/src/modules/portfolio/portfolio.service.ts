import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In, IsNull } from 'typeorm';
import { addDays, startOfWeek } from '../../common/dates/calendar-date.js';
import { ProblemException } from '../../common/errors/problem.exception.js';
import {
  RichTextError,
  sanitizeRichText,
} from '../../common/rich-text/rich-text.js';
import { RequestContext } from '../../common/tenancy/request-context.js';
import { AcademicsService } from '../academics/academics.service.js';
import { AssessmentsService } from '../assessment/assessments.service.js';
import { AttendanceService } from '../attendance/attendance.service.js';
import {
  FilesService,
  type FileView,
  fileView,
} from '../files/files.service.js';
import { PeopleService } from '../people/people.service.js';
import { PolicyService } from '../policies/policy.service.js';
import { ReportsService } from '../reports/reports.service.js';
import { SchoolClock } from '../schools/school-clock.service.js';
import { TimetablesService } from '../timetables/timetables.service.js';
import type { PortfolioItemDto } from './portfolio.dto.js';
import {
  PortfolioComment,
  PortfolioItem,
  PortfolioSettings,
} from './portfolio.entities.js';

/** How the signed-in user stands towards a portfolio. */
interface Standing {
  /** Sees pending items and comments as staff. */
  staff: boolean;
  /** Adds items that need no approval, and approves others. */
  teacher: boolean;
  /** The student whose portfolio it is. */
  self: boolean;
  /** Sees approved items only. */
  family: boolean;
}

const PAGE_SIZE = 20;
const invalid = (field: string, code: string) =>
  new ProblemException(HttpStatus.BAD_REQUEST, 'validation_failed', undefined, [
    { field, codes: [code] },
  ]);

@Injectable()
export class PortfolioService implements OnModuleInit {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly context: RequestContext,
    private readonly policy: PolicyService,
    private readonly people: PeopleService,
    private readonly academics: AcademicsService,
    private readonly files: FilesService,
    private readonly timetables: TimetablesService,
    private readonly attendance: AttendanceService,
    private readonly assessments: AssessmentsService,
    private readonly reports: ReportsService,
    private readonly clock: SchoolClock,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  onModuleInit() {
    this.files.registerUsage('portfolio', {
      assertCanUpload: async (target) => {
        const standing = await this.standing({
          studentId: target.studentId ?? null,
          classId: target.classId ?? null,
        });
        if (!standing.staff && !standing.self) throw new ForbiddenException();
      },
      canRead: async (file) => {
        const item = await this.tx.findOneBy(PortfolioItem, {
          fileId: file.id,
        });
        if (!item) return file.uploadedBy === this.context.userId;
        return this.canSee(item, await this.standing(item));
      },
    });
  }

  // ── Overview (PRT-1) ────────────────────────────────────────────────

  /**
   * Everything about a student in one place, read from each module as it is
   * now; nothing here is a copy. Fees are never part of it.
   */
  async overview(studentId: string) {
    await this.policy.assertStudentAccess(studentId);
    const [student] = await this.people.studentsByIds([studentId]);
    if (!student) throw new NotFoundException();
    const today = await this.clock.today();
    const week = startOfWeek(today);
    const term = await this.currentTerm(today);

    const [timetable, recent, attendance, grades, reports, files] =
      await Promise.all([
        this.timetables.forStudent(studentId, week, addDays(week, 6)),
        this.items(studentId),
        term
          ? this.attendance.studentSummary(
              studentId,
              term.startsOn,
              today < term.endsOn ? today : term.endsOn,
            )
          : null,
        this.assessments.studentGrades(studentId, term?.id),
        this.reports.published(studentId),
        this.files.studentFiles(studentId),
      ]);

    return {
      student,
      term: term && {
        id: term.id,
        name: term.name,
        startsOn: term.startsOn,
        endsOn: term.endsOn,
      },
      week: { from: week, to: addDays(week, 6), lessons: timetable },
      items: recent.items.slice(0, 5),
      attendance: attendance && {
        rate: attendance.rate,
        sessions: attendance.sessions,
        absent: attendance.absent,
        late: attendance.late,
        excused: attendance.excused,
      },
      grades: grades.map((entry) => {
        const latest = entry.assessments.find((assessment) => assessment.grade);
        return {
          class: entry.class,
          result: entry.result,
          reportingScale: entry.reportingScale,
          latest: latest
            ? {
                title: latest.title,
                value: latest.grade!.excused ? null : latest.grade!.value,
                scale: latest.scale.name,
              }
            : null,
        };
      }),
      reports,
      files,
    };
  }

  // ── Items (PRT-2/3/4/5) ─────────────────────────────────────────────

  /** Newest first. Families see approved items only. */
  async items(studentId: string, cursor?: string) {
    const standing = await this.standing({ studentId, classId: null });
    if (!standing.staff && !standing.self && !standing.family)
      throw new ForbiddenException();
    return this.page({ studentId }, standing, cursor);
  }

  async classItems(classId: string, cursor?: string) {
    const standing = await this.standing({ studentId: null, classId });
    if (!standing.staff && !standing.family && !standing.self)
      throw new ForbiddenException();
    return this.page({ classId, studentId: IsNull() }, standing, cursor);
  }

  async add(dto: PortfolioItemDto) {
    const studentId = dto.studentId ?? null;
    const classId = dto.classId ?? null;
    if (!studentId && !classId) throw invalid('studentId', 'required');
    if (
      studentId &&
      classId &&
      !(await this.people.currentClassIds(studentId)).includes(classId)
    )
      throw invalid('classId', 'notEnrolled');
    const standing = await this.standing({
      studentId,
      classId: studentId ? null : classId,
    });
    // Students add to their own portfolio; class portfolios are for staff.
    if (!standing.staff && !(standing.self && studentId))
      throw new ForbiddenException();

    let body: PortfolioItem['body'] = null;
    if (dto.kind === 'text') {
      try {
        body = sanitizeRichText(dto.body);
      } catch (error) {
        if (!(error instanceof RichTextError)) throw error;
        throw invalid('body', error.message);
      }
    }
    if (dto.kind === 'link' && !dto.url) throw invalid('url', 'required');
    if (dto.kind === 'image' || dto.kind === 'document')
      await this.assertOwnUpload(dto.fileId);

    const approvalRequired =
      (await this.tx.findOneBy(PortfolioSettings, {}))?.approvalRequired ??
      true;
    const userId = this.context.requireUserId();
    const item = await this.tx.save(
      this.tx.create(PortfolioItem, {
        studentId,
        classId,
        kind: dto.kind,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        url: dto.kind === 'link' ? dto.url! : null,
        body,
        fileId:
          dto.kind === 'image' || dto.kind === 'document' ? dto.fileId! : null,
        tags: [
          ...new Set(
            (dto.tags ?? [])
              .map((tag) => tag.trim().toLowerCase())
              .filter(Boolean),
          ),
        ],
        addedBy: userId,
        status: standing.teacher || !approvalRequired ? 'approved' : 'pending',
        approvedBy: standing.teacher ? userId : null,
      }),
    );
    return (await this.views([item], standing))[0];
  }

  async approve(id: string) {
    const item = await this.find(id);
    if (!(await this.standing(item)).teacher) throw new ForbiddenException();
    Object.assign(item, {
      status: 'approved',
      approvedBy: this.context.requireUserId(),
    });
    await this.tx.save(item);
  }

  async remove(id: string) {
    const item = await this.find(id);
    const standing = await this.standing(item);
    if (!standing.teacher && item.addedBy !== this.context.userId)
      throw new ForbiddenException();
    await this.tx.delete(PortfolioItem, { id });
    if (item.fileId) await this.files.deleteFiles([item.fileId]);
  }

  /** Staff comment; the student reflects on their own item (PRT-3). */
  async comment(id: string, body: string) {
    const item = await this.find(id);
    const standing = await this.standing(item);
    if (!standing.staff && !(standing.self && item.studentId))
      throw new ForbiddenException();
    await this.tx.save(
      this.tx.create(PortfolioComment, {
        itemId: id,
        authorId: this.context.requireUserId(),
        kind: standing.staff ? 'comment' : 'reflection',
        body: body.trim(),
      }),
    );
    return (await this.views([item], standing))[0];
  }

  async settings() {
    return {
      approvalRequired:
        (await this.tx.findOneBy(PortfolioSettings, {}))?.approvalRequired ??
        true,
    };
  }

  async saveSettings(approvalRequired: boolean) {
    const settings =
      (await this.tx.findOneBy(PortfolioSettings, {})) ??
      this.tx.create(PortfolioSettings, {});
    await this.tx.save(Object.assign(settings, { approvalRequired }));
    return { approvalRequired };
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private async standing({
    studentId,
    classId,
  }: {
    studentId: string | null;
    classId: string | null;
  }): Promise<Standing> {
    const userId = this.context.requireUserId();
    const schoolWide = this.policy.isSchoolWide;
    if (studentId) {
      const [own, mine, classes] = await Promise.all([
        this.policy.ownStudentIds(userId),
        this.policy.classIdsForUser(userId),
        this.people.currentClassIds(studentId),
      ]);
      const shared = classes.filter((id) => mine.includes(id));
      const roles = await Promise.all(
        shared.map((id) => this.policy.classRole(id, userId)),
      );
      const isStaff = roles.some(
        (role) => role === 'teacher' || role === 'teaching_assistant',
      );
      const self = (await this.people.studentIdForUser(userId)) === studentId;
      return {
        staff: schoolWide || isStaff,
        teacher: schoolWide || roles.includes('teacher'),
        self,
        family: own.includes(studentId) && !self,
      };
    }
    if (!classId)
      return { staff: false, teacher: false, self: false, family: false };
    const role = await this.policy.classRole(classId, userId);
    let enrolled = role === 'class_member';
    for (const own of await this.policy.ownStudentIds(userId)) {
      if ((await this.people.currentClassIds(own)).includes(classId))
        enrolled = true;
    }
    return {
      staff: schoolWide || role === 'teacher' || role === 'teaching_assistant',
      teacher: schoolWide || role === 'teacher',
      self: false,
      family: enrolled,
    };
  }

  private canSee(item: PortfolioItem, standing: Standing) {
    if (standing.staff || standing.self) return true;
    return standing.family && item.status === 'approved';
  }

  private async page(where: object, standing: Standing, cursor?: string) {
    const query = this.tx
      .createQueryBuilder(PortfolioItem, 'item')
      .where(where)
      .orderBy('item.id', 'DESC')
      .take(PAGE_SIZE + 1);
    if (!standing.staff && !standing.self)
      query.andWhere(`item.status = 'approved'`);
    if (cursor) query.andWhere('item.id < :cursor', { cursor });
    const rows = await query.getMany();
    const items = rows.slice(0, PAGE_SIZE);
    return {
      items: await this.views(items, standing),
      nextCursor: rows.length > PAGE_SIZE ? items[items.length - 1].id : null,
    };
  }

  private async views(items: PortfolioItem[], standing: Standing) {
    if (items.length === 0) return [];
    const [comments, files] = await Promise.all([
      this.tx.find(PortfolioComment, {
        where: { itemId: In(items.map((item) => item.id)) },
        order: { createdAt: 'ASC' },
      }),
      this.files.filesByIds(
        items.flatMap((item) => (item.fileId ? [item.fileId] : [])),
      ),
    ]);
    const people = await this.names([
      ...items.map((item) => item.addedBy),
      ...comments.map((comment) => comment.authorId),
    ]);
    const userId = this.context.userId;
    return items.map((item) => {
      const file = files.find((candidate) => candidate.id === item.fileId);
      return {
        id: item.id,
        studentId: item.studentId,
        classId: item.classId,
        kind: item.kind,
        title: item.title,
        description: item.description,
        url: item.url,
        body: item.body,
        file: file ? (fileView(file) as FileView) : null,
        tags: item.tags,
        status: item.status,
        addedBy: people.get(item.addedBy ?? '') ?? null,
        createdAt: item.createdAt,
        comments: comments
          .filter((comment) => comment.itemId === item.id)
          .map((comment) => ({
            id: comment.id,
            kind: comment.kind,
            body: comment.body,
            author: people.get(comment.authorId ?? '') ?? null,
            createdAt: comment.createdAt,
          })),
        canApprove: standing.teacher && item.status === 'pending',
        canDelete: standing.teacher || item.addedBy === userId,
      };
    });
  }

  private async assertOwnUpload(fileId: string | null | undefined) {
    if (!fileId) throw invalid('fileId', 'required');
    const file = await this.files.find(fileId).catch(() => null);
    if (
      !file ||
      file.purpose !== 'portfolio' ||
      file.uploadedBy !== this.context.userId
    )
      throw invalid('fileId', 'notFound');
    if (await this.tx.existsBy(PortfolioItem, { fileId }))
      throw invalid('fileId', 'alreadyUsed');
  }

  private async currentTerm(today: string) {
    const year = (await this.academics.listYears()).find(
      (candidate) => candidate.isCurrent,
    );
    if (!year) return null;
    return (
      (await this.academics.listTerms(year.id)).find(
        (term) => term.startsOn <= today && term.endsOn >= today,
      ) ?? null
    );
  }

  private async find(id: string): Promise<PortfolioItem> {
    const item = await this.tx.findOneBy(PortfolioItem, { id });
    if (!item) throw new NotFoundException();
    return item;
  }

  private async names(ids: (string | null)[]) {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    const rows = unique.length
      ? await this.tx.query<{ id: string; name: string }[]>(
          `SELECT id, name FROM users WHERE id = ANY($1)`,
          [unique],
        )
      : [];
    return new Map(rows.map((row) => [row.id, { id: row.id, name: row.name }]));
  }
}
