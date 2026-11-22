import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { ProblemException } from '../../common/errors/problem.exception.js';
import { RequestContext } from '../../common/tenancy/request-context.js';
import { AuditService } from '../audit/audit.service.js';
import { PolicyService } from '../policies/policy.service.js';
import type {
  CreateAcademicYearDto,
  CreateClassDto,
  DivisionDto,
  GradeLevelDto,
  ListClassesQueryDto,
  SetClassStaffDto,
  SubjectDto,
  TermDto,
  UpdateAcademicYearDto,
  UpdateClassDto,
} from './dto/academics.dto.js';
import { AcademicYear } from './entities/academic-year.entity.js';
import { ClassStaff } from './entities/class-staff.entity.js';
import { Division } from './entities/division.entity.js';
import { GradeLevel } from './entities/grade-level.entity.js';
import { SchoolClass } from './entities/school-class.entity.js';
import { Subject } from './entities/subject.entity.js';
import { Term } from './entities/term.entity.js';

export interface StaffView {
  userId: string;
  role: ClassStaff['role'];
  name: string;
  email: string;
}

export interface ClassView {
  id: string;
  code: string;
  name: string;
  academicYearId: string;
  gradeLevel: { id: string; name: string } | null;
  subject: { id: string; code: string; name: string } | null;
  staff: StaffView[];
}

@Injectable()
export class AcademicsService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly context: RequestContext,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  // ── Academic years ──────────────────────────────────────────────────

  listYears() {
    return this.tx.find(AcademicYear, { order: { startsOn: 'DESC' } });
  }

  async currentYear(): Promise<AcademicYear | null> {
    return this.tx.findOneBy(AcademicYear, { isCurrent: true });
  }

  async requireCurrentYear(): Promise<AcademicYear> {
    const year = await this.currentYear();
    if (!year)
      throw new ProblemException(
        HttpStatus.CONFLICT,
        'no_current_year',
        'Set a current academic year first',
      );
    return year;
  }

  async createYear(dto: CreateAcademicYearDto): Promise<AcademicYear> {
    assertDateRange(dto.startsOn, dto.endsOn);
    const year = await this.tx.save(
      this.tx.create(AcademicYear, {
        name: dto.name,
        startsOn: dto.startsOn,
        endsOn: dto.endsOn,
        isCurrent: false,
      }),
    );
    const isOnlyYear = (await this.tx.count(AcademicYear)) === 1;
    return dto.isCurrent || isOnlyYear ? this.makeCurrent(year.id) : year;
  }

  async updateYear(
    id: string,
    dto: UpdateAcademicYearDto,
  ): Promise<AcademicYear> {
    const year = await this.findYear(id);
    Object.assign(year, dto);
    assertDateRange(year.startsOn, year.endsOn);
    return this.tx.save(year);
  }

  /** Exactly one year is current; it is the default everywhere a year is needed. */
  async makeCurrent(id: string): Promise<AcademicYear> {
    const year = await this.findYear(id);
    await this.tx.update(
      AcademicYear,
      { isCurrent: true },
      { isCurrent: false },
    );
    year.isCurrent = true;
    return this.tx.save(year);
  }

  async findYear(id: string): Promise<AcademicYear> {
    const year = await this.tx.findOneBy(AcademicYear, { id });
    if (!year) throw new NotFoundException();
    return year;
  }

  // ── Terms ───────────────────────────────────────────────────────────

  listTerms(academicYearId: string) {
    return this.tx.find(Term, {
      where: { academicYearId },
      order: { startsOn: 'ASC' },
    });
  }

  async findTerm(id: string): Promise<Term> {
    const term = await this.tx.findOneBy(Term, { id });
    if (!term) throw new NotFoundException();
    return term;
  }

  async createTerm(academicYearId: string, dto: TermDto): Promise<Term> {
    await this.assertTermFits(academicYearId, dto);
    return this.tx.save(
      this.tx.create(Term, {
        academicYearId,
        name: dto.name,
        startsOn: dto.startsOn,
        endsOn: dto.endsOn,
      }),
    );
  }

  async updateTerm(id: string, dto: TermDto): Promise<Term> {
    const term = await this.tx.findOneBy(Term, { id });
    if (!term) throw new NotFoundException();
    await this.assertTermFits(term.academicYearId, dto, id);
    return this.tx.save(
      Object.assign(term, {
        name: dto.name,
        startsOn: dto.startsOn,
        endsOn: dto.endsOn,
      }),
    );
  }

  async deleteTerm(id: string): Promise<void> {
    const result = await this.tx.delete(Term, { id });
    if (!result.affected) throw new NotFoundException();
  }

  /** Terms sit inside their year and never overlap, so every date has at most one term. */
  private async assertTermFits(
    academicYearId: string,
    { startsOn, endsOn }: TermDto,
    ignoreId?: string,
  ) {
    const year = await this.findYear(academicYearId);
    if (endsOn < startsOn) {
      throw new ProblemException(
        HttpStatus.BAD_REQUEST,
        'validation_failed',
        undefined,
        [{ field: 'endsOn', codes: ['afterStart'] }],
      );
    }
    if (startsOn < year.startsOn || endsOn > year.endsOn) {
      throw new ProblemException(
        HttpStatus.BAD_REQUEST,
        'validation_failed',
        undefined,
        [
          {
            field: startsOn < year.startsOn ? 'startsOn' : 'endsOn',
            codes: ['withinYear'],
          },
        ],
      );
    }
    const overlapping = (await this.listTerms(academicYearId)).some(
      (term) =>
        term.id !== ignoreId &&
        term.startsOn <= endsOn &&
        term.endsOn >= startsOn,
    );
    if (overlapping)
      throw new ProblemException(
        HttpStatus.CONFLICT,
        'terms_overlap',
        'Terms cannot overlap',
      );
  }

  // ── Divisions and grade levels ──────────────────────────────────────

  async listDivisions() {
    const [divisions, gradeLevels] = await Promise.all([
      this.tx.find(Division, { order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.tx.find(GradeLevel, { order: { sortOrder: 'ASC', name: 'ASC' } }),
    ]);
    return divisions.map(({ id, name, sortOrder }) => ({
      id,
      name,
      sortOrder,
      gradeLevels: gradeLevels.filter((level) => level.divisionId === id),
    }));
  }

  createDivision(dto: DivisionDto) {
    return this.tx.save(
      this.tx.create(Division, {
        name: dto.name,
        sortOrder: dto.sortOrder ?? 0,
      }),
    );
  }

  async updateDivision(id: string, dto: DivisionDto) {
    const division = await this.tx.findOneBy(Division, { id });
    if (!division) throw new NotFoundException();
    return this.tx.save(Object.assign(division, dto));
  }

  async deleteDivision(id: string): Promise<void> {
    const result = await this.tx.delete(Division, { id });
    if (!result.affected) throw new NotFoundException();
  }

  async createGradeLevel(dto: GradeLevelDto) {
    await this.requireDivision(dto.divisionId);
    return this.tx.save(
      this.tx.create(GradeLevel, {
        divisionId: dto.divisionId,
        name: dto.name,
        sortOrder: dto.sortOrder ?? 0,
      }),
    );
  }

  async updateGradeLevel(id: string, dto: GradeLevelDto) {
    const level = await this.findGradeLevel(id);
    await this.requireDivision(dto.divisionId);
    return this.tx.save(Object.assign(level, dto));
  }

  async deleteGradeLevel(id: string): Promise<void> {
    const result = await this.tx.delete(GradeLevel, { id });
    if (!result.affected) throw new NotFoundException();
  }

  async findGradeLevel(id: string): Promise<GradeLevel> {
    const level = await this.tx.findOneBy(GradeLevel, { id });
    if (!level) throw new NotFoundException();
    return level;
  }

  async gradeLevelsByIds(ids: (string | null)[]): Promise<GradeLevel[]> {
    const present = [...new Set(ids.filter((id) => id !== null))];
    return present.length
      ? this.tx.findBy(GradeLevel, { id: In(present) })
      : [];
  }

  findGradeLevelByName(name: string) {
    return this.tx
      .createQueryBuilder(GradeLevel, 'level')
      .where('lower(level.name) = lower(:name)', { name })
      .getOne();
  }

  async findDivision(id: string): Promise<Division> {
    const division = await this.tx.findOneBy(Division, { id });
    if (!division) throw new NotFoundException();
    return division;
  }

  private async requireDivision(id: string) {
    if (!(await this.tx.existsBy(Division, { id }))) {
      throw new ProblemException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'division_not_found',
        'Unknown division',
        [{ field: 'divisionId', codes: ['notFound'] }],
      );
    }
  }

  // ── Subjects ────────────────────────────────────────────────────────

  listSubjects() {
    return this.tx.find(Subject, { order: { name: 'ASC' } });
  }

  createSubject(dto: SubjectDto) {
    return this.tx.save(this.tx.create(Subject, dto));
  }

  async updateSubject(id: string, dto: SubjectDto) {
    const subject = await this.tx.findOneBy(Subject, { id });
    if (!subject) throw new NotFoundException();
    return this.tx.save(Object.assign(subject, dto));
  }

  findSubjectByCode(code: string) {
    return this.tx
      .createQueryBuilder(Subject, 'subject')
      .where('lower(subject.code) = lower(:code)', { code })
      .getOne();
  }

  // ── Classes ─────────────────────────────────────────────────────────

  async listClasses({
    academicYearId,
    mine,
  }: ListClassesQueryDto): Promise<ClassView[]> {
    const yearId = academicYearId ?? (await this.currentYear())?.id;
    if (!yearId) return [];

    const onlyMine =
      mine === 'true' || !this.context.hasRole('admin', 'coordinator');
    const ids = onlyMine ? await this.policy.classIdsForUser() : undefined;
    if (ids && ids.length === 0) return [];

    const classes = await this.tx.find(SchoolClass, {
      where: { academicYearId: yearId, ...(ids && { id: In(ids) }) },
      order: { name: 'ASC' },
    });
    return this.toViews(classes);
  }

  async getClass(id: string): Promise<ClassView> {
    await this.policy.assertClassAccess(id);
    const [view] = await this.toViews([await this.findClass(id)]);
    return view;
  }

  async findClass(id: string): Promise<SchoolClass> {
    const schoolClass = await this.tx.findOneBy(SchoolClass, { id });
    if (!schoolClass) throw new NotFoundException();
    return schoolClass;
  }

  findClassByCode(academicYearId: string, code: string) {
    return this.tx
      .createQueryBuilder(SchoolClass, 'class')
      .where(
        'class.academic_year_id = :academicYearId AND lower(class.code) = lower(:code)',
        { academicYearId, code },
      )
      .getOne();
  }

  /** Classes of these grade levels (or of a division's grade levels), for audiences. */
  async classIdsForGradeLevels(gradeLevelIds: string[]): Promise<string[]> {
    if (gradeLevelIds.length === 0) return [];
    return (
      await this.tx.findBy(SchoolClass, { gradeLevelId: In(gradeLevelIds) })
    ).map((schoolClass) => schoolClass.id);
  }

  async gradeLevelIdsInDivision(divisionId: string): Promise<string[]> {
    return (await this.tx.findBy(GradeLevel, { divisionId })).map(
      (level) => level.id,
    );
  }

  async staffUserIds(
    classIds: string[],
    roles?: ClassStaff['role'][],
  ): Promise<string[]> {
    if (classIds.length === 0) return [];
    const staff = await this.tx.findBy(ClassStaff, {
      classId: In(classIds),
      ...(roles ? { role: In(roles) } : {}),
    });
    return [...new Set(staff.map((member) => member.userId))];
  }

  async findClassesByIds(ids: string[]): Promise<ClassView[]> {
    if (ids.length === 0) return [];
    return this.toViews(await this.tx.findBy(SchoolClass, { id: In(ids) }));
  }

  async createClass(dto: CreateClassDto): Promise<ClassView> {
    await this.findYear(dto.academicYearId);
    const created = await this.tx.save(this.tx.create(SchoolClass, dto));
    const [view] = await this.toViews([created]);
    return view;
  }

  async updateClass(id: string, dto: UpdateClassDto): Promise<ClassView> {
    const schoolClass = await this.findClass(id);
    const [view] = await this.toViews([
      await this.tx.save(Object.assign(schoolClass, dto)),
    ]);
    return view;
  }

  /** Replaces a class's staff. Everyone listed must already be a member of the school. */
  async setStaff(
    classId: string,
    { staff }: SetClassStaffDto,
  ): Promise<ClassView> {
    await this.findClass(classId);
    const userIds = [...new Set(staff.map((member) => member.userId))];
    await this.assertMembers(userIds);

    const before = await this.tx.findBy(ClassStaff, { classId });
    await this.tx.delete(ClassStaff, { classId });
    if (staff.length > 0) {
      await this.tx.insert(
        ClassStaff,
        staff.map(({ userId, role }) => ({
          id: uuidv7(),
          classId,
          userId,
          role,
        })),
      );
    }
    await this.audit.record({
      action: 'class.staff_changed',
      entityType: 'class',
      entityId: classId,
      before: { staff: before.map(({ userId, role }) => ({ userId, role })) },
      after: { staff: staff.map(({ userId, role }) => ({ userId, role })) },
    });
    return this.getClass(classId);
  }

  /** Adds staff without touching the others; used by imports. */
  async addStaff(
    classId: string,
    userId: string,
    role: ClassStaff['role'],
  ): Promise<void> {
    await this.assertMembers([userId]);
    await this.tx
      .createQueryBuilder()
      .insert()
      .into(ClassStaff)
      .values({ id: uuidv7(), classId, userId, role })
      .orIgnore()
      .execute();
  }

  /** Members of the current school whose email is in the list, keyed by lowercase email. */
  async membersByEmail(emails: string[]): Promise<Map<string, string>> {
    if (emails.length === 0) return new Map();
    const rows = await this.tx.query<{ id: string; email: string }[]>(
      `SELECT u.id, lower(u.email) AS email FROM users u
         JOIN members m ON m.user_id = u.id
        WHERE m.organization_id = $1 AND lower(u.email) = ANY($2)`,
      [
        this.context.requireSchoolId(),
        emails.map((email) => email.toLowerCase()),
      ],
    );
    return new Map(rows.map((row) => [row.email, row.id]));
  }

  async assertMembers(userIds: string[]) {
    if (userIds.length === 0) return;
    const rows = await this.tx.query<{ user_id: string }[]>(
      `SELECT user_id FROM members WHERE organization_id = $1 AND user_id = ANY($2)`,
      [this.context.requireSchoolId(), userIds],
    );
    if (rows.length !== userIds.length) {
      throw new ProblemException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'not_a_member',
        'Staff must be members of the school',
      );
    }
  }

  private async toViews(classes: SchoolClass[]): Promise<ClassView[]> {
    if (classes.length === 0) return [];
    const classIds = classes.map((schoolClass) => schoolClass.id);
    const [levels, subjects, staff] = await Promise.all([
      this.tx.findBy(GradeLevel, {
        id: In(classes.map((c) => c.gradeLevelId).filter((id) => id !== null)),
      }),
      this.tx.findBy(Subject, {
        id: In(classes.map((c) => c.subjectId).filter((id) => id !== null)),
      }),
      this.tx.query<(StaffView & { class_id: string; user_id: string })[]>(
        `SELECT cs.class_id, cs.user_id, cs.role, u.name, u.email
           FROM class_staff cs JOIN users u ON u.id = cs.user_id
          WHERE cs.class_id = ANY($1)
          ORDER BY cs.role, u.name`,
        [classIds],
      ),
    ]);

    return classes.map((schoolClass) => {
      const level = levels.find(
        (candidate) => candidate.id === schoolClass.gradeLevelId,
      );
      const subject = subjects.find(
        (candidate) => candidate.id === schoolClass.subjectId,
      );
      return {
        id: schoolClass.id,
        code: schoolClass.code,
        name: schoolClass.name,
        academicYearId: schoolClass.academicYearId,
        gradeLevel: level ? { id: level.id, name: level.name } : null,
        subject: subject
          ? { id: subject.id, code: subject.code, name: subject.name }
          : null,
        staff: staff
          .filter((member) => member.class_id === schoolClass.id)
          .map((member) => ({
            userId: member.user_id,
            role: member.role,
            name: member.name,
            email: member.email,
          })),
      };
    });
  }
}

function assertDateRange(startsOn: string, endsOn: string) {
  if (endsOn <= startsOn) {
    throw new ProblemException(
      HttpStatus.BAD_REQUEST,
      'validation_failed',
      'The year must end after it starts',
      [{ field: 'endsOn', codes: ['afterStart'] }],
    );
  }
}
