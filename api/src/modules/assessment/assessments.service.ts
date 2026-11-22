import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Between, In } from 'typeorm';
import {
  type FieldError,
  ProblemException,
} from '../../common/errors/problem.exception.js';
import { RequestContext } from '../../common/tenancy/request-context.js';
import { AcademicsService } from '../academics/academics.service.js';
import { AuditService } from '../audit/audit.service.js';
import { rolesAllow } from '../auth/access-control.js';
import {
  CalendarService,
  type CalendarItem,
} from '../calendar/calendar.service.js';
import { CurriculumService } from '../curriculum/curriculum.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PeopleService } from '../people/people.service.js';
import { PolicyService } from '../policies/policy.service.js';
import { SchoolClock } from '../schools/school-clock.service.js';
import type {
  CreateAssessmentDto,
  GradeEntryDto,
  SaveGradesDto,
  UpdateAssessmentDto,
} from './dto/assessment.dto.js';
import { AssessmentCriterion } from './entities/assessment-criterion.entity.js';
import { AssessmentStandard } from './entities/assessment-standard.entity.js';
import { Assessment } from './entities/assessment.entity.js';
import { Grade } from './entities/grade.entity.js';
import { Submission } from './entities/submission.entity.js';
import { GradingService, type ScaleView } from './grading.service.js';
import {
  aggregate,
  fromMastery,
  GradeValueError,
  parseValue,
  toMastery,
} from './grading/grading.js';
import type { GradingScaleSnapshot } from './grading/types.js';

interface ScaleRef {
  id: string;
  name: string;
  version: number;
  definition: GradingScaleSnapshot;
}

export interface AssessmentView {
  id: string;
  classId: string;
  title: string;
  description: string | null;
  kind: Assessment['kind'];
  dueOn: string | null;
  categoryId: string | null;
  weight: number;
  scale: ScaleRef;
  criteria: { id: string; name: string; weight: number; scale: ScaleRef }[];
  standardIds: string[];
}

export interface GradeView {
  studentId: string;
  value: string | null;
  mastery: number | null;
  criterionValues: Record<string, string>;
  comment: string | null;
  excused: boolean;
  status: Grade['status'];
  publishedAt: Date | null;
}

const gradeView = (grade: Grade): GradeView => ({
  studentId: grade.studentId,
  value: grade.value,
  mastery: grade.mastery,
  criterionValues: grade.criterionValues,
  comment: grade.comment,
  excused: grade.excused,
  status: grade.status,
  publishedAt: grade.publishedAt,
});

/** Formative work informs teaching; only summative assessments count towards term results. */
const COUNTS_TOWARDS_RESULT: Assessment['kind'][] = ['summative'];

@Injectable()
export class AssessmentsService implements OnModuleInit {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly context: RequestContext,
    private readonly policy: PolicyService,
    private readonly grading: GradingService,
    private readonly academics: AcademicsService,
    private readonly people: PeopleService,
    private readonly curriculum: CurriculumService,
    private readonly calendar: CalendarService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly clock: SchoolClock,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  onModuleInit() {
    this.calendar.registerSource('assessment', (from, to) =>
      this.dueDates(from, to),
    );
  }

  // ── Assessments ─────────────────────────────────────────────────────

  async listForClass(classId: string): Promise<AssessmentView[]> {
    await this.policy.assertClassAccess(classId);
    const assessments = await this.tx.find(Assessment, {
      where: { classId },
      order: { dueOn: { direction: 'DESC', nulls: 'LAST' }, createdAt: 'DESC' },
    });
    return this.views(assessments);
  }

  async get(id: string): Promise<AssessmentView> {
    const assessment = await this.find(id);
    await this.policy.assertClassAccess(assessment.classId);
    return (await this.views([assessment]))[0];
  }

  async create(
    classId: string,
    dto: CreateAssessmentDto,
  ): Promise<AssessmentView> {
    await this.academics.findClass(classId);
    await this.policy.assertClassAccess(classId, ['teacher']);
    const scale = await this.grading.findScale(dto.scaleId);
    await this.assertCategory(classId, dto.categoryId);
    await this.curriculum.assertStandardsExist(dto.standardIds ?? []);

    const assessment = await this.tx.save(
      this.tx.create(Assessment, {
        classId,
        title: dto.title,
        description: dto.description || null,
        kind: dto.kind,
        dueOn: dto.dueOn ?? null,
        scaleId: scale.id,
        scaleVersion: scale.currentVersion,
        categoryId: dto.categoryId ?? null,
        weight: dto.weight ?? 1,
        createdBy: this.context.userId ?? null,
      }),
    );
    for (const [index, criterion] of (dto.criteria ?? []).entries()) {
      const criterionScale = await this.grading.findScale(criterion.scaleId);
      await this.tx.save(
        this.tx.create(AssessmentCriterion, {
          assessmentId: assessment.id,
          name: criterion.name,
          scaleId: criterionScale.id,
          scaleVersion: criterionScale.currentVersion,
          weight: criterion.weight ?? 1,
          sortOrder: index,
        }),
      );
    }
    for (const standardId of new Set(dto.standardIds ?? [])) {
      await this.tx.save(
        this.tx.create(AssessmentStandard, {
          assessmentId: assessment.id,
          standardId,
        }),
      );
    }
    return (await this.views([assessment]))[0];
  }

  async update(id: string, dto: UpdateAssessmentDto): Promise<AssessmentView> {
    const assessment = await this.find(id);
    await this.policy.assertClassAccess(assessment.classId, ['teacher']);
    if (dto.categoryId !== undefined)
      await this.assertCategory(assessment.classId, dto.categoryId);
    Object.assign(assessment, {
      title: dto.title ?? assessment.title,
      description:
        dto.description === undefined
          ? assessment.description
          : dto.description || null,
      kind: dto.kind ?? assessment.kind,
      dueOn: dto.dueOn === undefined ? assessment.dueOn : dto.dueOn,
      categoryId:
        dto.categoryId === undefined ? assessment.categoryId : dto.categoryId,
      weight: dto.weight ?? assessment.weight,
    });
    return (await this.views([await this.tx.save(assessment)]))[0];
  }

  async remove(id: string): Promise<void> {
    const assessment = await this.find(id);
    await this.policy.assertClassAccess(assessment.classId, ['teacher']);
    if (
      await this.tx.existsBy(Grade, { assessmentId: id, status: 'published' })
    ) {
      throw new ProblemException(
        HttpStatus.CONFLICT,
        'has_published_grades',
        'Published grades cannot be deleted',
      );
    }
    await this.tx.delete(Assessment, { id });
  }

  // ── Grading ─────────────────────────────────────────────────────────

  /** Everything a teacher needs to grade: the class list, grades so far and submissions. */
  async sheet(id: string) {
    const assessment = await this.get(id);
    await this.policy.assertClassAccess(assessment.classId, [
      'teacher',
      'teaching_assistant',
    ]);
    const [students, grades, submissions] = await Promise.all([
      this.people.roster(assessment.classId),
      this.tx.findBy(Grade, { assessmentId: id }),
      this.tx.findBy(Submission, { assessmentId: id }),
    ]);
    return {
      assessment,
      students,
      grades: grades.map(gradeView),
      submissions: submissions.map(
        ({ studentId, body, fileId, submittedAt, isLate }) => ({
          studentId,
          body,
          fileId,
          submittedAt,
          isLate,
        }),
      ),
      canPublish: await this.canPublish(assessment.classId),
    };
  }

  /**
   * Saves grades as drafts, or publishes them. Teaching assistants only save
   * drafts and cannot touch a published grade (ASM-7). Changes to a published
   * grade are audited with the old and new values (ASM-13).
   */
  async saveGrades(
    id: string,
    { grades: entries, publish = false }: SaveGradesDto,
  ) {
    const assessment = await this.get(id);
    await this.policy.assertClassAccess(assessment.classId, [
      'teacher',
      'teaching_assistant',
    ]);
    const canPublish = await this.canPublish(assessment.classId);
    if (publish && !canPublish) throw new ForbiddenException();

    const enrolled = new Set(
      (await this.people.roster(assessment.classId)).map(
        (student) => student.id,
      ),
    );
    const existing = new Map(
      (await this.tx.findBy(Grade, { assessmentId: id })).map(
        (grade) => [grade.studentId, grade] as const,
      ),
    );
    const errors: FieldError[] = [];
    const computed = entries.map((entry, index) => {
      if (!enrolled.has(entry.studentId)) {
        errors.push({
          field: `grades.${index}.studentId`,
          codes: ['notEnrolled'],
        });
        return null;
      }
      return this.compute(assessment, entry, index, errors);
    });
    if (errors.length > 0) {
      throw new ProblemException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'validation_failed',
        undefined,
        errors,
      );
    }

    const userId = this.context.requireUserId();
    const now = new Date();
    const newlyPublished: string[] = [];
    for (const [index, entry] of entries.entries()) {
      const values = computed[index]!;
      const before = existing.get(entry.studentId);
      const isEmpty =
        values.value === null && !values.comment && !values.excused;
      if (!before && isEmpty) continue;
      if (before?.status === 'published' && !canPublish)
        throw new ForbiddenException();

      const grade =
        before ??
        this.tx.create(Grade, {
          assessmentId: id,
          studentId: entry.studentId,
          status: 'draft',
        });
      const snapshot = before && {
        value: before.value,
        comment: before.comment,
        excused: before.excused,
      };
      Object.assign(grade, values, { enteredBy: userId });
      const changed =
        snapshot !== undefined &&
        (snapshot.value !== grade.value ||
          snapshot.comment !== grade.comment ||
          snapshot.excused !== grade.excused);

      if (
        publish &&
        grade.status === 'draft' &&
        (grade.value !== null || grade.excused)
      ) {
        Object.assign(grade, {
          status: 'published',
          publishedAt: now,
          publishedBy: userId,
        });
        newlyPublished.push(grade.studentId);
      }
      await this.tx.save(grade);

      if (before?.status === 'published' && changed) {
        await this.audit.record({
          action: 'grade.changed',
          entityType: 'grade',
          entityId: grade.id,
          before: snapshot,
          after: {
            value: grade.value,
            comment: grade.comment,
            excused: grade.excused,
          },
        });
      }
    }
    await this.announce(assessment, newlyPublished);
    return this.sheet(id);
  }

  /** Publishes every draft that has a result, including those entered by assistants. */
  async publishAll(id: string) {
    const assessment = await this.get(id);
    if (!(await this.canPublish(assessment.classId)))
      throw new ForbiddenException();
    const drafts = (
      await this.tx.findBy(Grade, { assessmentId: id, status: 'draft' })
    ).filter((grade) => grade.value !== null || grade.excused);
    const userId = this.context.requireUserId();
    const now = new Date();
    for (const grade of drafts)
      Object.assign(grade, {
        status: 'published',
        publishedAt: now,
        publishedBy: userId,
      });
    await this.tx.save(drafts);
    await this.announce(
      assessment,
      drafts.map((grade) => grade.studentId),
    );
    return this.sheet(id);
  }

  private async announce(assessment: AssessmentView, studentIds: string[]) {
    if (studentIds.length === 0) return;
    await this.audit.record({
      action: 'grade.published',
      entityType: 'assessment',
      entityId: assessment.id,
      after: { studentIds },
    });
    const recipients = [...(await this.people.accountUserIds(studentIds)).values()].flat();
    await this.notifications.deliver({
      userIds: recipients,
      type: 'grade.published',
      params: { assessment: assessment.title },
      link: '/grades',
      locales: await this.people.guardianLocales(recipients),
      mail: (url) => ({
        type: 'grade.published',
        url,
        params: { assessment: assessment.title },
      }),
    });
  }

  private compute(
    assessment: AssessmentView,
    entry: GradeEntryDto,
    index: number,
    errors: FieldError[],
  ) {
    const excused = entry.excused ?? false;
    const comment = entry.comment?.trim() || null;
    const fail = (field: string, error: unknown) => {
      if (!(error instanceof GradeValueError)) throw error;
      errors.push({ field: `grades.${index}.${field}`, codes: [error.code] });
    };

    if (assessment.criteria.length > 0) {
      const criterionValues: Record<string, string> = {};
      const results: { mastery: number; weight: number }[] = [];
      for (const [criterionId, raw] of Object.entries(
        entry.criterionValues ?? {},
      )) {
        const criterion = assessment.criteria.find(
          (candidate) => candidate.id === criterionId,
        );
        if (!criterion) {
          errors.push({
            field: `grades.${index}.criterionValues.${criterionId}`,
            codes: ['notFound'],
          });
          continue;
        }
        if (raw === null || String(raw).trim() === '') continue;
        try {
          const value = parseValue(criterion.scale.definition, raw);
          criterionValues[criterionId] = String(value);
          results.push({
            mastery: toMastery(criterion.scale.definition, value),
            weight: criterion.weight,
          });
        } catch (error) {
          fail(`criterionValues.${criterionId}`, error);
        }
      }
      const mastery =
        results.length > 0 ? aggregate(results, 'weighted_average') : null;
      return {
        criterionValues,
        mastery,
        value:
          mastery === null
            ? null
            : String(fromMastery(assessment.scale.definition, mastery)),
        comment,
        excused,
      };
    }

    if (
      entry.value === undefined ||
      entry.value === null ||
      entry.value.trim() === ''
    ) {
      return {
        criterionValues: {},
        mastery: null,
        value: null,
        comment,
        excused,
      };
    }
    try {
      const value = parseValue(assessment.scale.definition, entry.value);
      return {
        criterionValues: {},
        mastery: toMastery(assessment.scale.definition, value),
        value: String(value),
        comment,
        excused,
      };
    } catch (error) {
      fail('value', error);
      return null;
    }
  }

  private async canPublish(classId: string): Promise<boolean> {
    if (!rolesAllow(this.context.roles, { assessment: ['publish'] }))
      return false;
    return (await this.policy.classRole(classId)) === 'teacher';
  }

  // ── Gradebook and results ───────────────────────────────────────────

  /** Every student's grades and term result in one class (ASM-8). */
  async gradebook(classId: string, termId?: string) {
    await this.policy.assertClassAccess(classId, [
      'teacher',
      'teaching_assistant',
    ]);
    const [schoolClass] = await this.academics.findClassesByIds([classId]);
    if (!schoolClass) throw new NotFoundException();
    const term = termId ? await this.academics.findTerm(termId) : null;
    const assessments = await this.tx.find(Assessment, {
      where: {
        classId,
        ...(term ? { dueOn: Between(term.startsOn, term.endsOn) } : {}),
      },
      order: { dueOn: { direction: 'ASC', nulls: 'LAST' }, createdAt: 'ASC' },
    });
    const [students, grades, rules, views] = await Promise.all([
      this.people.roster(classId),
      assessments.length
        ? this.tx.findBy(Grade, {
            assessmentId: In(assessments.map((a) => a.id)),
          })
        : [],
      this.grading.rulesFor(schoolClass.subject?.id ?? null),
      this.views(assessments),
    ]);

    return {
      class: schoolClass,
      term,
      method: rules.method,
      reportingScale: rules.reportingScale,
      categories: rules.categories,
      assessments: views.map(
        ({ id, title, kind, dueOn, categoryId, weight, scale }) => ({
          id,
          title,
          kind,
          dueOn,
          categoryId,
          weight,
          scale: {
            id: scale.id,
            name: scale.name,
            kind: scale.definition.kind,
          },
        }),
      ),
      students,
      grades: grades.map((grade) => ({
        assessmentId: grade.assessmentId,
        ...gradeView(grade),
      })),
      results: students.map((student) => ({
        studentId: student.id,
        ...this.termResult(
          assessments,
          grades.filter((grade) => grade.studentId === student.id),
          rules,
        ),
      })),
    };
  }

  /** A student's published work and results by class, for the student and their family. */
  async studentGrades(studentId: string, termId?: string) {
    await this.policy.assertStudentAccess(studentId);
    const term = termId ? await this.academics.findTerm(termId) : null;
    const classes = await this.academics.findClassesByIds(
      await this.people.currentClassIds(studentId),
    );
    const assessments = classes.length
      ? await this.tx.find(Assessment, {
          where: {
            classId: In(classes.map((schoolClass) => schoolClass.id)),
            ...(term ? { dueOn: Between(term.startsOn, term.endsOn) } : {}),
          },
          order: { dueOn: { direction: 'DESC', nulls: 'LAST' } },
        })
      : [];
    const ids = assessments.map((assessment) => assessment.id);
    const [grades, submissions, views] = await Promise.all([
      ids.length
        ? this.tx.findBy(Grade, {
            assessmentId: In(ids),
            studentId,
            status: 'published',
          })
        : [],
      ids.length
        ? this.tx.findBy(Submission, { assessmentId: In(ids), studentId })
        : [],
      this.views(assessments),
    ]);

    return Promise.all(
      classes.map(async (schoolClass) => {
        const rules = await this.grading.rulesFor(
          schoolClass.subject?.id ?? null,
        );
        const classAssessments = assessments.filter(
          (assessment) => assessment.classId === schoolClass.id,
        );
        const classGrades = grades.filter((grade) =>
          classAssessments.some((a) => a.id === grade.assessmentId),
        );
        return {
          class: {
            id: schoolClass.id,
            code: schoolClass.code,
            name: schoolClass.name,
            subject: schoolClass.subject,
          },
          reportingScale: rules.reportingScale && {
            id: rules.reportingScale.id,
            name: rules.reportingScale.name,
          },
          result: this.termResult(classAssessments, classGrades, rules),
          assessments: await Promise.all(
            classAssessments.map(async (assessment) => {
              const view = views.find(
                (candidate) => candidate.id === assessment.id,
              )!;
              const grade = classGrades.find(
                (candidate) => candidate.assessmentId === assessment.id,
              );
              const submission = submissions.find(
                (candidate) => candidate.assessmentId === assessment.id,
              );
              return {
                id: assessment.id,
                title: assessment.title,
                description: assessment.description,
                kind: assessment.kind,
                dueOn: assessment.dueOn,
                scale: { id: view.scale.id, name: view.scale.name },
                grade: grade
                  ? {
                      value: grade.value,
                      reported: await this.reported(
                        assessment,
                        grade,
                        rules.reportingScale,
                      ),
                      comment: grade.comment,
                      excused: grade.excused,
                      publishedAt: grade.publishedAt,
                    }
                  : null,
                submission: submission
                  ? {
                      body: submission.body,
                      fileId: submission.fileId,
                      submittedAt: submission.submittedAt,
                      isLate: submission.isLate,
                    }
                  : null,
              };
            }),
          ),
        };
      }),
    );
  }

  /** The grade on the reporting scale, converted with the school's table in force when it was published. */
  private async reported(
    assessment: Assessment,
    grade: Grade,
    reportingScale: ScaleView | null,
  ) {
    if (!reportingScale || grade.value === null || grade.excused) return null;
    return String(
      await this.grading.convertValue(
        { scaleId: assessment.scaleId, version: assessment.scaleVersion },
        reportingScale,
        grade.value,
        grade.publishedAt ?? new Date(),
      ),
    );
  }

  private termResult(
    assessments: Assessment[],
    grades: Grade[],
    rules: Awaited<ReturnType<GradingService['rulesFor']>>,
  ): { mastery: number | null; value: string | null } {
    const counted = grades.flatMap((grade) => {
      const assessment = assessments.find(
        (candidate) => candidate.id === grade.assessmentId,
      );
      if (!assessment || !COUNTS_TOWARDS_RESULT.includes(assessment.kind))
        return [];
      if (
        grade.status !== 'published' ||
        grade.excused ||
        grade.mastery === null
      )
        return [];
      return [
        {
          mastery: grade.mastery,
          weight: assessment.weight,
          category: assessment.categoryId,
          date: assessment.dueOn,
        },
      ];
    });
    const mastery = aggregate(counted, rules.method, rules.categoryWeights);
    return {
      mastery,
      value:
        mastery === null || !rules.reportingScale
          ? null
          : String(fromMastery(rules.reportingScale.definition, mastery)),
    };
  }

  // ── Submissions ─────────────────────────────────────────────────────

  /** A student hands in text work (ASM-10). Handing in after the due date is flagged late. */
  async submit(id: string, work: { body?: string; fileId?: string }) {
    const assessment = await this.find(id);
    const studentId = await this.people.studentIdForUser(
      this.context.requireUserId(),
    );
    if (
      !studentId ||
      !(await this.people.currentClassIds(studentId)).includes(
        assessment.classId,
      )
    ) {
      throw new ForbiddenException();
    }
    const today = await this.clock.today();
    const submission =
      (await this.tx.findOneBy(Submission, { assessmentId: id, studentId })) ??
      this.tx.create(Submission, {
        assessmentId: id,
        studentId,
        body: null,
        fileId: null,
      });
    Object.assign(submission, {
      ...(work.body === undefined ? {} : { body: work.body }),
      ...(work.fileId === undefined ? {} : { fileId: work.fileId }),
      submittedAt: new Date(),
      isLate: assessment.dueOn !== null && today > assessment.dueOn,
    });
    const saved = await this.tx.save(submission);
    return {
      body: saved.body,
      fileId: saved.fileId,
      submittedAt: saved.submittedAt,
      isLate: saved.isLate,
    };
  }

  /** The student and class a handed-in file belongs to, for download checks. */
  async submissionOwner(
    fileId: string,
  ): Promise<{ studentId: string; classId: string } | null> {
    const submission = await this.tx.findOneBy(Submission, { fileId });
    if (!submission) return null;
    const assessment = await this.find(submission.assessmentId);
    return { studentId: submission.studentId, classId: assessment.classId };
  }

  // ── Calendar ────────────────────────────────────────────────────────

  /** Due dates on the calendar of the people in the class (CAL-6). */
  private async dueDates(from: string, to: string): Promise<CalendarItem[]> {
    const classIds = this.policy.isSchoolWide
      ? null
      : (await this.policy.audience()).classIds;
    if (classIds?.length === 0) return [];
    const assessments = await this.tx.find(Assessment, {
      where: {
        dueOn: Between(from, to),
        ...(classIds ? { classId: In(classIds) } : {}),
      },
    });
    const classes = await this.academics.findClassesByIds([
      ...new Set(assessments.map((a) => a.classId)),
    ]);
    const isStaff = rolesAllow(this.context.roles, { assessment: ['grade'] });
    return assessments.map((assessment) => ({
      id: assessment.id,
      source: 'assessment',
      kind: 'due',
      title: `${assessment.title} · ${classes.find((schoolClass) => schoolClass.id === assessment.classId)?.name ?? ''}`,
      description: null,
      startsOn: assessment.dueOn!,
      endsOn: assessment.dueOn!,
      startTime: null,
      endTime: null,
      link: isStaff ? `/assessments/${assessment.id}` : '/grades',
    }));
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private async find(id: string): Promise<Assessment> {
    const assessment = await this.tx.findOneBy(Assessment, { id });
    if (!assessment) throw new NotFoundException();
    return assessment;
  }

  /** The category must belong to the policy that applies to the class's subject. */
  private async assertCategory(
    classId: string,
    categoryId: string | null | undefined,
  ) {
    if (!categoryId) return;
    const [schoolClass] = await this.academics.findClassesByIds([classId]);
    const rules = await this.grading.rulesFor(schoolClass?.subject?.id ?? null);
    if (!rules.categories.some((category) => category.id === categoryId)) {
      throw new ProblemException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'validation_failed',
        undefined,
        [{ field: 'categoryId', codes: ['notFound'] }],
      );
    }
  }

  private async views(assessments: Assessment[]): Promise<AssessmentView[]> {
    if (assessments.length === 0) return [];
    const ids = assessments.map((assessment) => assessment.id);
    const [criteria, standards] = await Promise.all([
      this.tx.find(AssessmentCriterion, {
        where: { assessmentId: In(ids) },
        order: { sortOrder: 'ASC' },
      }),
      this.tx.findBy(AssessmentStandard, { assessmentId: In(ids) }),
    ]);
    const scales = new Map(
      (await this.grading.listScales()).map((scale) => [scale.id, scale]),
    );
    const ref = async (
      scaleId: string,
      version: number,
    ): Promise<ScaleRef> => ({
      id: scaleId,
      name: scales.get(scaleId)?.name ?? '',
      version,
      definition: await this.grading.snapshot(scaleId, version),
    });

    return Promise.all(
      assessments.map(async (assessment) => ({
        id: assessment.id,
        classId: assessment.classId,
        title: assessment.title,
        description: assessment.description,
        kind: assessment.kind,
        dueOn: assessment.dueOn,
        categoryId: assessment.categoryId,
        weight: assessment.weight,
        scale: await ref(assessment.scaleId, assessment.scaleVersion),
        criteria: await Promise.all(
          criteria
            .filter((criterion) => criterion.assessmentId === assessment.id)
            .map(async (criterion) => ({
              id: criterion.id,
              name: criterion.name,
              weight: criterion.weight,
              scale: await ref(criterion.scaleId, criterion.scaleVersion),
            })),
        ),
        standardIds: standards
          .filter((standard) => standard.assessmentId === assessment.id)
          .map((standard) => standard.standardId),
      })),
    );
  }
}
