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
import { Brackets, IsNull } from 'typeorm';
import { zonedTimeToUtc } from '../../common/dates/calendar-date.js';
import { ProblemException } from '../../common/errors/problem.exception.js';
import {
  plainText,
  RichTextError,
  sanitizeRichText,
} from '../../common/rich-text/rich-text.js';
import { RequestContext } from '../../common/tenancy/request-context.js';
import { TenantTransactions } from '../../common/tenancy/tenant-transactions.js';
import { AcademicsService } from '../academics/academics.service.js';
import { rolesAllow } from '../auth/access-control.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PeopleService } from '../people/people.service.js';
import { PolicyService } from '../policies/policy.service.js';
import { SchoolClock } from '../schools/school-clock.service.js';
import type { CreateAnnouncementDto } from './announcement.dto.js';
import {
  Announcement,
  ClassAnnouncementSettings,
} from './announcement.entities.js';

export const ANNOUNCEMENTS_QUEUE = 'announcements';

export interface PublishJob {
  schoolId: string;
  announcementId: string;
}

export interface AnnouncementView {
  id: string;
  title: string;
  body: Announcement['body'];
  audience: Announcement['audience'];
  audienceId: string | null;
  audienceRole: string | null;
  audienceName: string | null;
  author: { id: string; name: string } | null;
  publishAt: Date;
  publishedAt: Date | null;
  canDelete: boolean;
}

/** Sends now if the time is this close; anything later is scheduled. */
const SEND_NOW_WINDOW_MS = 30_000;
const PAGE_SIZE = 20;

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly context: RequestContext,
    private readonly transactions: TenantTransactions,
    private readonly policy: PolicyService,
    private readonly academics: AcademicsService,
    private readonly people: PeopleService,
    private readonly notifications: NotificationsService,
    private readonly clock: SchoolClock,
    @InjectQueue(ANNOUNCEMENTS_QUEUE) private readonly queue: Queue<PublishJob>,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  /** What the user may read: their school, roles, divisions, grades and classes, newest first. */
  async feed(cursor?: string, limit = PAGE_SIZE) {
    const query = this.tx
      .createQueryBuilder(Announcement, 'announcement')
      .where('announcement.published_at IS NOT NULL')
      .orderBy('announcement.published_at', 'DESC')
      .addOrderBy('announcement.id', 'DESC')
      .take(limit + 1);
    if (!this.policy.isSchoolWide) {
      const audience = await this.policy.audience();
      const userId = this.context.requireUserId();
      query.andWhere(
        new Brackets((where) =>
          where
            .where(`announcement.audience = 'school'`)
            .orWhere('announcement.author_id = :userId', { userId })
            .orWhere(
              `announcement.audience = 'role' AND announcement.audience_role = ANY(:roles)`,
              { roles: this.context.roles },
            )
            .orWhere(
              `announcement.audience = 'division' AND announcement.audience_id = ANY(:divisionIds)`,
              { divisionIds: audience.divisionIds },
            )
            .orWhere(
              `announcement.audience = 'grade_level' AND announcement.audience_id = ANY(:gradeLevelIds)`,
              {
                gradeLevelIds: audience.gradeLevelIds,
              },
            )
            .orWhere(
              `announcement.audience = 'class' AND announcement.audience_id = ANY(:classIds)`,
              { classIds: audience.classIds },
            ),
        ),
      );
    }
    if (cursor) {
      const [publishedAt, id] = cursor.split('_');
      query.andWhere(
        '(announcement.published_at, announcement.id) < (:publishedAt, :id)',
        { publishedAt, id },
      );
    }
    const rows = await query.getMany();
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    return {
      items: await this.views(items),
      nextCursor:
        rows.length > limit
          ? `${last.publishedAt!.toISOString()}_${last.id}`
          : null,
    };
  }

  /** Announcements waiting for their time: the user's own, or all for school-wide posters. */
  async scheduled(): Promise<AnnouncementView[]> {
    const mine = !rolesAllow(this.context.roles, {
      announcement: ['post-school'],
    });
    const rows = await this.tx.find(Announcement, {
      where: {
        publishedAt: IsNull(),
        ...(mine ? { authorId: this.context.requireUserId() } : {}),
      },
      order: { publishAt: 'ASC' },
    });
    return this.views(rows);
  }

  async create(dto: CreateAnnouncementDto): Promise<AnnouncementView> {
    await this.assertCanPost(dto);
    let body: Announcement['body'];
    try {
      body = sanitizeRichText(dto.body);
    } catch (error) {
      if (!(error instanceof RichTextError)) throw error;
      throw new ProblemException(
        HttpStatus.BAD_REQUEST,
        'validation_failed',
        undefined,
        [{ field: 'body', codes: [error.message] }],
      );
    }
    const now = new Date();
    const publishAt = dto.publishAt
      ? zonedTimeToUtc(dto.publishAt, await this.clock.timeZone())
      : now;
    if (publishAt.getTime() < now.getTime() - SEND_NOW_WINDOW_MS) {
      throw new ProblemException(
        HttpStatus.BAD_REQUEST,
        'validation_failed',
        undefined,
        [{ field: 'publishAt', codes: ['inThePast'] }],
      );
    }

    const announcement = await this.tx.save(
      this.tx.create(Announcement, {
        title: dto.title.trim(),
        body,
        audience: dto.audience,
        audienceId: dto.audienceId ?? null,
        audienceRole: dto.audienceRole ?? null,
        authorId: this.context.requireUserId(),
        publishAt,
        publishedAt: null,
      }),
    );
    const delay = publishAt.getTime() - now.getTime();
    if (delay <= SEND_NOW_WINDOW_MS) {
      await this.publish(announcement);
    } else {
      await this.queue.add(
        'publish',
        {
          schoolId: this.context.requireSchoolId(),
          announcementId: announcement.id,
        },
        { delay, jobId: `announcement-${announcement.id}` },
      );
    }
    return (await this.views([announcement]))[0];
  }

  async remove(id: string): Promise<void> {
    const announcement = await this.tx.findOneBy(Announcement, { id });
    if (!announcement) throw new NotFoundException();
    const isAuthor = announcement.authorId === this.context.userId;
    if (
      !isAuthor &&
      !rolesAllow(this.context.roles, { announcement: ['post-school'] })
    )
      throw new ForbiddenException();
    await this.tx.delete(Announcement, { id });
    if (!announcement.publishedAt)
      await this.queue.remove(`announcement-${id}`);
  }

  /** Runs in the worker when a scheduled announcement's time comes. */
  async publishScheduled(
    { schoolId, announcementId }: PublishJob,
    now = new Date(),
  ): Promise<boolean> {
    return this.transactions.runInSchool(schoolId, async () => {
      const announcement = await this.tx.findOneBy(Announcement, {
        id: announcementId,
      });
      if (
        !announcement ||
        announcement.publishedAt ||
        announcement.publishAt.getTime() > now.getTime() + 1000
      )
        return false;
      await this.publish(announcement);
      return true;
    });
  }

  async classSettings(classId: string) {
    await this.policy.assertClassAccess(classId);
    const settings = await this.tx.findOneBy(ClassAnnouncementSettings, {
      classId,
    });
    return { assistantsCanPost: settings?.assistantsCanPost ?? false };
  }

  async saveClassSettings(classId: string, assistantsCanPost: boolean) {
    await this.policy.assertClassAccess(classId, ['teacher']);
    const settings =
      (await this.tx.findOneBy(ClassAnnouncementSettings, { classId })) ??
      this.tx.create(ClassAnnouncementSettings, { classId });
    await this.tx.save(Object.assign(settings, { assistantsCanPost }));
    return { assistantsCanPost };
  }

  private async publish(announcement: Announcement) {
    announcement.publishedAt = new Date();
    await this.tx.save(announcement);
    const [author] = announcement.authorId
      ? await this.userNames([announcement.authorId])
      : [];
    const recipients = (await this.recipients(announcement)).filter(
      (userId) => userId !== announcement.authorId,
    );
    const excerpt = plainText(announcement.body);
    await this.notifications.deliver({
      userIds: recipients,
      type: 'announcement.published',
      params: { title: announcement.title, author: author?.name ?? '' },
      link: '/announcements',
      locales: await this.people.guardianLocales(recipients),
      mail: (url) => ({
        type: 'announcement.published',
        url,
        params: {
          title: announcement.title,
          author: author?.name ?? 'Darsi',
          excerpt,
        },
      }),
    });
  }

  /** Everyone in the audience: staff, students and the guardians of those students. */
  private async recipients(announcement: Announcement): Promise<string[]> {
    if (announcement.audience === 'school') return this.policy.memberUserIds();
    if (announcement.audience === 'role')
      return this.policy.memberUserIds(announcement.audienceRole ?? undefined);

    let gradeLevelIds: string[] = [];
    let classIds: string[] = [];
    if (announcement.audience === 'class')
      classIds = [announcement.audienceId!];
    if (announcement.audience === 'grade_level')
      gradeLevelIds = [announcement.audienceId!];
    if (announcement.audience === 'division')
      gradeLevelIds = await this.academics.gradeLevelIdsInDivision(
        announcement.audienceId!,
      );
    if (gradeLevelIds.length)
      classIds = await this.academics.classIdsForGradeLevels(gradeLevelIds);

    const [staff, studentIds] = await Promise.all([
      this.academics.staffUserIds(classIds),
      this.people.studentIdsIn({ classIds, gradeLevelIds }),
    ]);
    const families = await this.people.accountUserIds(studentIds);
    return [...new Set([...staff, ...[...families.values()].flat()])];
  }

  /** Teachers post to their classes; assistants too if the teacher allows it; school-wide audiences need more (ANN-1/2). */
  private async assertCanPost(dto: CreateAnnouncementDto) {
    const fieldError = (field: string, code: string) =>
      new ProblemException(
        HttpStatus.BAD_REQUEST,
        'validation_failed',
        undefined,
        [{ field, codes: [code] }],
      );
    if ((dto.audience === 'role') !== Boolean(dto.audienceRole))
      throw fieldError('audienceRole', 'required');
    const needsId = !['school', 'role'].includes(dto.audience);
    if (needsId !== Boolean(dto.audienceId))
      throw fieldError('audienceId', needsId ? 'required' : 'notAllowed');

    const schoolWide = rolesAllow(this.context.roles, {
      announcement: ['post-school'],
    });
    if (dto.audience !== 'class') {
      if (!schoolWide) throw new ForbiddenException();
      if (dto.audience === 'division')
        await this.academics.findDivision(dto.audienceId!);
      if (dto.audience === 'grade_level')
        await this.academics.findGradeLevel(dto.audienceId!);
      return;
    }
    await this.academics.findClass(dto.audienceId!);
    if (schoolWide) return;
    const role = await this.policy.classRole(dto.audienceId!);
    if (
      role === 'teacher' &&
      rolesAllow(this.context.roles, { announcement: ['post-class'] })
    )
      return;
    if (
      role === 'teaching_assistant' &&
      (await this.classSettingsRow(dto.audienceId!))?.assistantsCanPost
    )
      return;
    throw new ForbiddenException();
  }

  private classSettingsRow(classId: string) {
    return this.tx.findOneBy(ClassAnnouncementSettings, { classId });
  }

  private async userNames(ids: string[]) {
    if (ids.length === 0) return [];
    return this.tx.query<{ id: string; name: string }[]>(
      `SELECT id, name FROM users WHERE id = ANY($1)`,
      [ids],
    );
  }

  private async views(rows: Announcement[]): Promise<AnnouncementView[]> {
    const authors = await this.userNames([
      ...new Set(rows.flatMap((row) => (row.authorId ? [row.authorId] : []))),
    ]);
    const ids = (audience: Announcement['audience']) =>
      rows
        .filter((row) => row.audience === audience)
        .map((row) => row.audienceId!);
    const [classes, levels, divisions] = await Promise.all([
      this.academics.findClassesByIds(ids('class')),
      this.academics.gradeLevelsByIds(ids('grade_level')),
      ids('division').length ? this.academics.listDivisions() : [],
    ]);
    const canModerate = rolesAllow(this.context.roles, {
      announcement: ['post-school'],
    });
    const names = new Map<string, string>([
      ...classes.map((item) => [item.id, item.name] as const),
      ...levels.map((item) => [item.id, item.name] as const),
      ...divisions.map((item) => [item.id, item.name] as const),
    ]);
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      audience: row.audience,
      audienceId: row.audienceId,
      audienceRole: row.audienceRole,
      audienceName: row.audienceId ? (names.get(row.audienceId) ?? null) : null,
      author: authors.find((author) => author.id === row.authorId) ?? null,
      publishAt: row.publishAt,
      publishedAt: row.publishedAt,
      canDelete: canModerate || row.authorId === this.context.userId,
    }));
  }
}
