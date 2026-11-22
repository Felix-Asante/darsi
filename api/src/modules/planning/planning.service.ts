import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In } from 'typeorm';
import { addDays } from '../../common/dates/calendar-date.js';
import {
  type FieldError,
  ProblemException,
} from '../../common/errors/problem.exception.js';
import {
  type RichTextNode,
  RichTextError,
  sanitizeRichText,
} from '../../common/rich-text/rich-text.js';
import { RequestContext } from '../../common/tenancy/request-context.js';
import { AcademicsService } from '../academics/academics.service.js';
import { AssessmentsService } from '../assessment/assessments.service.js';
import { CurriculumService } from '../curriculum/curriculum.service.js';
import { PolicyService } from '../policies/policy.service.js';
import type {
  CollaboratorDto,
  CopyUnitDto,
  LessonDto,
  TemplateDto,
  UnitDto,
} from './planning.dto.js';
import {
  Lesson,
  PlanTemplate,
  Unit,
  UnitAssessment,
  UnitClass,
  UnitCollaborator,
  UnitStandard,
} from './planning.entities.js';

type Access = 'owner' | 'editor' | 'viewer';

/** Sanitises each rich-text value, collecting errors by field instead of failing on the first. */
function richText(
  value: unknown,
  field: string,
  errors: FieldError[],
): RichTextNode | null {
  if (value === null || value === undefined) return null;
  try {
    return sanitizeRichText(value);
  } catch (error) {
    if (!(error instanceof RichTextError)) throw error;
    errors.push({ field, codes: [error.message] });
    return null;
  }
}

function assertNoErrors(errors: FieldError[]) {
  if (errors.length > 0)
    throw new ProblemException(
      HttpStatus.BAD_REQUEST,
      'validation_failed',
      undefined,
      errors,
    );
}

@Injectable()
export class PlanningService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly context: RequestContext,
    private readonly policy: PolicyService,
    private readonly academics: AcademicsService,
    private readonly curriculum: CurriculumService,
    private readonly assessments: AssessmentsService,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  // ── Templates ───────────────────────────────────────────────────────

  listTemplates() {
    return this.tx.find(PlanTemplate, { order: { name: 'ASC' } });
  }

  async saveTemplate(dto: TemplateDto, id?: string) {
    const keys = dto.fields.map((field) => field.key);
    if (new Set(keys).size !== keys.length)
      assertNoErrors([{ field: 'fields', codes: ['uniqueKeys'] }]);
    const template = id
      ? await this.tx.findOneBy(PlanTemplate, { id })
      : this.tx.create(PlanTemplate, {});
    if (!template) throw new NotFoundException();
    return this.tx.save(
      Object.assign(template, {
        name: dto.name,
        frameworkId: dto.frameworkId ?? null,
        fields: dto.fields.map(({ key, label, kind }) => ({
          key,
          label,
          kind,
        })),
      }),
    );
  }

  // ── Units ───────────────────────────────────────────────────────────

  async listForClass(classId: string) {
    await this.policy.assertClassAccess(classId);
    const links = await this.tx.findBy(UnitClass, { classId });
    return this.summaries(links.map((link) => link.unitId));
  }

  /** Units the user wrote or was invited to. */
  async mine() {
    const userId = this.context.requireUserId();
    const [own, shared] = await Promise.all([
      this.tx.findBy(Unit, { createdBy: userId }),
      this.tx.findBy(UnitCollaborator, { userId }),
    ]);
    return this.summaries([
      ...own.map((unit) => unit.id),
      ...shared.map((entry) => entry.unitId),
    ]);
  }

  async get(id: string) {
    const unit = await this.find(id);
    const access = await this.access(unit);
    if (!access) throw new ForbiddenException();
    const [classes, standards, collaborators, assessments, lessons] =
      await Promise.all([
        this.tx.findBy(UnitClass, { unitId: id }),
        this.tx.findBy(UnitStandard, { unitId: id }),
        this.tx.findBy(UnitCollaborator, { unitId: id }),
        this.tx.findBy(UnitAssessment, { unitId: id }),
        this.tx.find(Lesson, {
          where: { unitId: id },
          order: { sortOrder: 'ASC', date: 'ASC' },
        }),
      ]);
    const people = await this.names([
      unit.createdBy,
      unit.updatedBy,
      ...collaborators.map((entry) => entry.userId),
      ...lessons.map((lesson) => lesson.updatedBy),
    ]);
    return {
      ...this.unitFields(unit),
      access,
      createdBy: people.get(unit.createdBy ?? '') ?? null,
      updatedBy: people.get(unit.updatedBy ?? '') ?? null,
      classes: await this.academics.findClassesByIds(
        classes.map((link) => link.classId),
      ),
      standardIds: standards.map((link) => link.standardId),
      assessmentIds: assessments.map((link) => link.assessmentId),
      collaborators: collaborators.map((entry) => ({
        userId: entry.userId,
        role: entry.role,
        name: people.get(entry.userId)?.name ?? '',
      })),
      lessons: lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        date: lesson.date,
        objectives: lesson.objectives,
        activities: lesson.activities,
        resources: lesson.resources,
        sortOrder: lesson.sortOrder,
        updatedAt: lesson.updatedAt,
        updatedBy: people.get(lesson.updatedBy ?? '') ?? null,
      })),
    };
  }

  async create(dto: UnitDto) {
    for (const classId of dto.classIds)
      await this.policy.assertClassAccess(classId, ['teacher']);
    const unit = this.tx.create(Unit, {
      createdBy: this.context.requireUserId(),
    });
    await this.applyUnit(unit, dto);
    return this.get(unit.id);
  }

  async update(id: string, dto: UnitDto) {
    const unit = await this.find(id);
    await this.assertCanEdit(unit);
    const current = (await this.tx.findBy(UnitClass, { unitId: id })).map(
      (link) => link.classId,
    );
    for (const classId of dto.classIds.filter(
      (candidate) => !current.includes(candidate),
    )) {
      await this.policy.assertClassAccess(classId, ['teacher']);
    }
    await this.applyUnit(unit, dto);
    return this.get(id);
  }

  async remove(id: string) {
    const unit = await this.find(id);
    if ((await this.access(unit)) !== 'owner') throw new ForbiddenException();
    await this.tx.delete(Unit, { id });
  }

  /** Shares the unit with co-teachers and assistants as editors or viewers (PLN-4). */
  async setCollaborators(id: string, collaborators: CollaboratorDto[]) {
    const unit = await this.find(id);
    if ((await this.access(unit)) !== 'owner') throw new ForbiddenException();
    const entries = collaborators.filter(
      (entry) => entry.userId !== unit.createdBy,
    );
    await this.academics.assertMembers(entries.map((entry) => entry.userId));
    await this.tx.delete(UnitCollaborator, { unitId: id });
    for (const entry of entries) {
      await this.tx.save(
        this.tx.create(UnitCollaborator, {
          unitId: id,
          userId: entry.userId,
          role: entry.role,
        }),
      );
    }
    return this.get(id);
  }

  /** Links assessments of the unit's classes (PLN-5). */
  async linkAssessments(id: string, assessmentIds: string[]) {
    const unit = await this.find(id);
    await this.assertCanEdit(unit);
    const classIds = (await this.tx.findBy(UnitClass, { unitId: id })).map(
      (link) => link.classId,
    );
    for (const assessmentId of new Set(assessmentIds)) {
      const assessment = await this.assessments.get(assessmentId);
      if (!classIds.includes(assessment.classId))
        assertNoErrors([
          { field: 'assessmentIds', codes: ['notInUnitClasses'] },
        ]);
    }
    await this.tx.delete(UnitAssessment, { unitId: id });
    for (const assessmentId of new Set(assessmentIds)) {
      await this.tx.save(
        this.tx.create(UnitAssessment, { unitId: id, assessmentId }),
      );
    }
    return this.get(id);
  }

  /** A copy for other classes or next year, with its lessons and dates moved (PLN-6). */
  async copy(id: string, { classIds, shiftDays = 0 }: CopyUnitDto) {
    const source = await this.find(id);
    if (!(await this.access(source))) throw new ForbiddenException();
    for (const classId of classIds)
      await this.policy.assertClassAccess(classId, ['teacher']);
    const shift = (date: string | null) =>
      date ? addDays(date, shiftDays) : null;
    const userId = this.context.requireUserId();

    const copy = await this.tx.save(
      this.tx.create(Unit, {
        templateId: source.templateId,
        title: source.title,
        startsOn: shift(source.startsOn),
        endsOn: shift(source.endsOn),
        objectives: source.objectives,
        fieldValues: source.fieldValues,
        createdBy: userId,
        updatedBy: userId,
      }),
    );
    for (const classId of new Set(classIds))
      await this.tx.save(
        this.tx.create(UnitClass, { unitId: copy.id, classId }),
      );
    for (const link of await this.tx.findBy(UnitStandard, { unitId: id })) {
      await this.tx.save(
        this.tx.create(UnitStandard, {
          unitId: copy.id,
          standardId: link.standardId,
        }),
      );
    }
    for (const lesson of await this.tx.findBy(Lesson, { unitId: id })) {
      await this.tx.save(
        this.tx.create(Lesson, {
          unitId: copy.id,
          title: lesson.title,
          date: shift(lesson.date),
          objectives: lesson.objectives,
          activities: lesson.activities,
          resources: lesson.resources,
          sortOrder: lesson.sortOrder,
          updatedBy: userId,
        }),
      );
    }
    return this.get(copy.id);
  }

  // ── Lessons ─────────────────────────────────────────────────────────

  async saveLesson(unitId: string, dto: LessonDto, lessonId?: string) {
    const unit = await this.find(unitId);
    await this.assertCanEdit(unit);
    const errors: FieldError[] = [];
    const values = {
      title: dto.title,
      date: dto.date ?? null,
      objectives: richText(dto.objectives, 'objectives', errors),
      activities: richText(dto.activities, 'activities', errors),
      resources: richText(dto.resources, 'resources', errors),
      updatedBy: this.context.requireUserId(),
    };
    assertNoErrors(errors);
    const lesson = lessonId
      ? await this.tx.findOneBy(Lesson, { id: lessonId, unitId })
      : this.tx.create(Lesson, {
          unitId,
          sortOrder:
            dto.sortOrder ?? (await this.tx.countBy(Lesson, { unitId })),
        });
    if (!lesson) throw new NotFoundException();
    await this.tx.save(
      Object.assign(
        lesson,
        values,
        dto.sortOrder === undefined ? {} : { sortOrder: dto.sortOrder },
      ),
    );
    await this.touch(unit);
    return this.get(unitId);
  }

  async removeLesson(unitId: string, lessonId: string) {
    const unit = await this.find(unitId);
    await this.assertCanEdit(unit);
    const result = await this.tx.delete(Lesson, { id: lessonId, unitId });
    if (!result.affected) throw new NotFoundException();
    await this.touch(unit);
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private async applyUnit(unit: Unit, dto: UnitDto) {
    const errors: FieldError[] = [];
    const template = dto.templateId
      ? await this.tx.findOneBy(PlanTemplate, { id: dto.templateId })
      : null;
    if (dto.templateId && !template)
      errors.push({ field: 'templateId', codes: ['notFound'] });
    if (dto.startsOn && dto.endsOn && dto.endsOn < dto.startsOn)
      errors.push({ field: 'endsOn', codes: ['afterStart'] });

    const fieldValues: Unit['fieldValues'] = {};
    for (const field of template?.fields ?? []) {
      const value = dto.fieldValues?.[field.key];
      if (value === undefined || value === null || value === '') continue;
      if (field.kind === 'text') {
        if (typeof value === 'string' && value.length <= 5000)
          fieldValues[field.key] = value;
        else
          errors.push({
            field: `fieldValues.${field.key}`,
            codes: ['isString'],
          });
      } else {
        const doc = richText(value, `fieldValues.${field.key}`, errors);
        if (doc) fieldValues[field.key] = doc;
      }
    }
    const objectives = richText(dto.objectives, 'objectives', errors);
    assertNoErrors(errors);
    await this.curriculum.assertStandardsExist(dto.standardIds ?? []);
    for (const classId of dto.classIds) await this.academics.findClass(classId);

    Object.assign(unit, {
      title: dto.title,
      templateId: template?.id ?? null,
      startsOn: dto.startsOn ?? null,
      endsOn: dto.endsOn ?? null,
      objectives,
      fieldValues,
      updatedBy: this.context.requireUserId(),
    });
    await this.tx.save(unit);
    await this.tx.delete(UnitClass, { unitId: unit.id });
    for (const classId of new Set(dto.classIds))
      await this.tx.save(
        this.tx.create(UnitClass, { unitId: unit.id, classId }),
      );
    await this.tx.delete(UnitStandard, { unitId: unit.id });
    for (const standardId of new Set(dto.standardIds ?? [])) {
      await this.tx.save(
        this.tx.create(UnitStandard, { unitId: unit.id, standardId }),
      );
    }
  }

  /** The unit records who edited it last (PLN-4). */
  private async touch(unit: Unit) {
    unit.updatedBy = this.context.requireUserId();
    await this.tx.save(unit);
  }

  /**
   * Owners and editors change a unit; viewers, staff of its classes and
   * school-wide staff read it.
   */
  private async access(unit: Unit): Promise<Access | null> {
    const userId = this.context.requireUserId();
    if (unit.createdBy === userId) return 'owner';
    const collaborator = await this.tx.findOneBy(UnitCollaborator, {
      unitId: unit.id,
      userId,
    });
    if (collaborator) return collaborator.role;
    if (this.policy.isSchoolWide) return 'viewer';
    const classIds = (await this.tx.findBy(UnitClass, { unitId: unit.id })).map(
      (link) => link.classId,
    );
    const mine = await this.policy.classIdsForUser(userId);
    return classIds.some((classId) => mine.includes(classId)) ? 'viewer' : null;
  }

  private async assertCanEdit(unit: Unit) {
    const access = await this.access(unit);
    if (access !== 'owner' && access !== 'editor')
      throw new ForbiddenException();
  }

  private async find(id: string): Promise<Unit> {
    const unit = await this.tx.findOneBy(Unit, { id });
    if (!unit) throw new NotFoundException();
    return unit;
  }

  private unitFields(unit: Unit) {
    return {
      id: unit.id,
      title: unit.title,
      templateId: unit.templateId,
      startsOn: unit.startsOn,
      endsOn: unit.endsOn,
      objectives: unit.objectives,
      fieldValues: unit.fieldValues,
      updatedAt: unit.updatedAt,
    };
  }

  private async summaries(ids: string[]) {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return [];
    const [units, links, lessonCounts] = await Promise.all([
      this.tx.find(Unit, {
        where: { id: In(unique) },
        order: { startsOn: { direction: 'ASC', nulls: 'LAST' }, title: 'ASC' },
      }),
      this.tx.findBy(UnitClass, { unitId: In(unique) }),
      this.tx.query<{ unit_id: string; count: number }[]>(
        `SELECT unit_id, count(*)::int AS count FROM lessons WHERE unit_id = ANY($1) GROUP BY unit_id`,
        [unique],
      ),
    ]);
    const classes = await this.academics.findClassesByIds([
      ...new Set(links.map((link) => link.classId)),
    ]);
    return units.map((unit) => ({
      id: unit.id,
      title: unit.title,
      startsOn: unit.startsOn,
      endsOn: unit.endsOn,
      classes: links
        .filter((link) => link.unitId === unit.id)
        .flatMap((link) =>
          classes.filter((schoolClass) => schoolClass.id === link.classId),
        )
        .map(({ id, code, name }) => ({ id, code, name })),
      lessonCount:
        lessonCounts.find((row) => row.unit_id === unit.id)?.count ?? 0,
    }));
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
