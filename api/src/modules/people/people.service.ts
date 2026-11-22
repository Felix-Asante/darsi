import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Brackets, In, IsNull } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { ProblemException } from '../../common/errors/problem.exception.js';
import type { CursorPage } from '../../common/pagination/cursor-pagination.js';
import { RequestContext } from '../../common/tenancy/request-context.js';
import {
  AcademicsService,
  type ClassView,
} from '../academics/academics.service.js';
import { AuditService } from '../audit/audit.service.js';
import { PolicyService } from '../policies/policy.service.js';
import { SchoolClock } from '../schools/school-clock.service.js';
import type {
  CreateGuardianDto,
  CreateStudentDto,
  EnrolStudentsDto,
  LinkGuardianDto,
  ListGuardiansQueryDto,
  ListStudentsQueryDto,
  UpdateGuardianDto,
  UpdateStudentDto,
} from './dto/people.dto.js';
import { Enrolment } from './entities/enrolment.entity.js';
import { Family } from './entities/family.entity.js';
import {
  GuardianLink,
  type Relationship,
} from './entities/guardian-link.entity.js';
import { Guardian } from './entities/guardian.entity.js';
import { Student } from './entities/student.entity.js';

export interface StudentSummary {
  id: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  status: Student['status'];
  gradeLevel: { id: string; name: string } | null;
}

export interface StudentProfile extends StudentSummary {
  dateOfBirth: string | null;
  email: string | null;
  enrolledOn: string | null;
  withdrawnOn: string | null;
  withdrawalReason: string | null;
  family: { id: string; name: string } | null;
  guardians: (GuardianSummary & {
    relationship: Relationship;
    isPrimaryContact: boolean;
  })[];
  siblings: StudentSummary[];
  classes: (ClassView & { enrolledSince: string })[];
}

export interface GuardianSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  preferredLocale: 'en' | 'fr';
  hasAccount: boolean;
}

const pick = <T extends object, K extends keyof T>(source: T, keys: K[]) =>
  Object.fromEntries(
    keys
      .filter((key) => source[key] !== undefined)
      .map((key) => [key, source[key]]),
  ) as Partial<Pick<T, K>>;

type NameCursor = [lastName: string, firstName: string, id: string];

/** The directory is sorted by name, so its cursor carries the last row's sort key. */
const encodeNameCursor = (key: NameCursor) =>
  Buffer.from(JSON.stringify(key)).toString('base64url');

function decodeNameCursor(cursor: string): NameCursor {
  try {
    const key: unknown = JSON.parse(
      Buffer.from(cursor, 'base64url').toString(),
    );
    if (
      Array.isArray(key) &&
      key.length === 3 &&
      key.every((part) => typeof part === 'string')
    )
      return key as NameCursor;
  } catch {
    // Falls through to the validation error below.
  }
  throw new ProblemException(
    HttpStatus.BAD_REQUEST,
    'validation_failed',
    'Invalid cursor',
    [{ field: 'cursor', codes: ['isCursor'] }],
  );
}

@Injectable()
export class PeopleService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly context: RequestContext,
    private readonly policy: PolicyService,
    private readonly academics: AcademicsService,
    private readonly clock: SchoolClock,
    private readonly audit: AuditService,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  // ── Students ────────────────────────────────────────────────────────

  async listStudents({
    search,
    gradeLevelId,
    status,
    cursor,
    limit,
  }: ListStudentsQueryDto): Promise<CursorPage<StudentSummary>> {
    const query = this.tx
      .createQueryBuilder(Student, 'student')
      .orderBy('student.last_name', 'ASC')
      .addOrderBy('student.first_name', 'ASC')
      .addOrderBy('student.id', 'ASC')
      .take(limit + 1);
    if (status) query.andWhere('student.status = :status', { status });
    if (gradeLevelId)
      query.andWhere('student.grade_level_id = :gradeLevelId', {
        gradeLevelId,
      });
    if (cursor) {
      const [lastName, firstName, id] = decodeNameCursor(cursor);
      query.andWhere(
        '(student.last_name, student.first_name, student.id) > (:lastName, :firstName, :id)',
        {
          lastName,
          firstName,
          id,
        },
      );
    }
    if (search) {
      const term = `%${search.replace(/[%_\\]/g, '\\$&')}%`;
      query.andWhere(
        new Brackets((where) =>
          where
            .where('student.first_name ILIKE :term', { term })
            .orWhere('student.last_name ILIKE :term', { term })
            .orWhere('student.preferred_name ILIKE :term', { term })
            .orWhere('student.student_number ILIKE :term', { term })
            .orWhere(
              `(student.first_name || ' ' || student.last_name) ILIKE :term`,
              { term },
            ),
        ),
      );
    }
    const rows = await query.getMany();
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    return {
      items: await this.summaries(items),
      nextCursor:
        rows.length > limit
          ? encodeNameCursor([last.lastName, last.firstName, last.id])
          : null,
    };
  }

  async getStudent(id: string): Promise<StudentProfile> {
    await this.policy.assertStudentAccess(id);
    const student = await this.findStudent(id);
    const [summary] = await this.summaries([student]);

    const [family, links, siblings, enrolments] = await Promise.all([
      student.familyId
        ? this.tx.findOneBy(Family, { id: student.familyId })
        : null,
      this.tx.findBy(GuardianLink, { studentId: id }),
      student.familyId
        ? this.tx.findBy(Student, { familyId: student.familyId })
        : [],
      this.tx.findBy(Enrolment, { studentId: id, endsOn: IsNull() }),
    ]);
    const guardians = links.length
      ? await this.tx.findBy(Guardian, {
          id: In(links.map((link) => link.guardianId)),
        })
      : [];
    const classes = await this.academics.findClassesByIds(
      enrolments.map((enrolment) => enrolment.classId),
    );

    return {
      ...summary,
      dateOfBirth: student.dateOfBirth,
      email: student.email,
      enrolledOn: student.enrolledOn,
      withdrawnOn: student.withdrawnOn,
      withdrawalReason: student.withdrawalReason,
      family: family ? { id: family.id, name: family.name } : null,
      guardians: links
        .map((link) => {
          const guardian = guardians.find(
            (candidate) => candidate.id === link.guardianId,
          );
          return guardian
            ? {
                ...guardianSummary(guardian),
                relationship: link.relationship,
                isPrimaryContact: link.isPrimaryContact,
              }
            : null;
        })
        .filter((guardian) => guardian !== null),
      siblings: await this.summaries(
        siblings.filter((sibling) => sibling.id !== id),
      ),
      classes: classes.map((view) => ({
        ...view,
        enrolledSince: enrolments.find(
          (enrolment) => enrolment.classId === view.id,
        )!.startsOn,
      })),
    };
  }

  async createStudent(dto: CreateStudentDto): Promise<Student> {
    if (dto.gradeLevelId) await this.academics.findGradeLevel(dto.gradeLevelId);
    return this.tx.save(
      this.tx.create(Student, {
        ...pick(dto, [
          'studentNumber',
          'firstName',
          'lastName',
          'preferredName',
          'dateOfBirth',
          'gradeLevelId',
        ]),
        email: dto.email?.toLowerCase() ?? null,
        enrolledOn: dto.enrolledOn ?? (await this.clock.today()),
        status: 'active',
        userId: dto.email ? await this.memberIdByEmail(dto.email) : null,
      }),
    );
  }

  async updateStudent(id: string, dto: UpdateStudentDto): Promise<Student> {
    const student = await this.findStudent(id);
    if (dto.gradeLevelId) await this.academics.findGradeLevel(dto.gradeLevelId);
    Object.assign(
      student,
      pick(dto, [
        'studentNumber',
        'firstName',
        'lastName',
        'preferredName',
        'dateOfBirth',
        'gradeLevelId',
      ]),
    );
    if (dto.email !== undefined)
      student.email = dto.email?.toLowerCase() ?? null;
    return this.tx.save(student);
  }

  async ownStudents(): Promise<StudentSummary[]> {
    return this.studentsByIds(await this.policy.ownStudentIds());
  }

  /** Students enrolled now in these classes, or placed in these grade levels. */
  async studentIdsIn({
    classIds = [],
    gradeLevelIds = [],
  }: {
    classIds?: string[];
    gradeLevelIds?: string[];
  }): Promise<string[]> {
    const [enrolled, placed] = await Promise.all([
      classIds.length
        ? this.tx.findBy(Enrolment, { classId: In(classIds), endsOn: IsNull() })
        : [],
      gradeLevelIds.length
        ? this.tx.findBy(Student, {
            gradeLevelId: In(gradeLevelIds),
            status: 'active',
          })
        : [],
    ]);
    return [
      ...new Set([
        ...enrolled.map((enrolment) => enrolment.studentId),
        ...placed.map((student) => student.id),
      ]),
    ];
  }

  /** The language each guardian chose for school mail, by their account. */
  async guardianLocales(userIds: string[]): Promise<Map<string, string>> {
    if (userIds.length === 0) return new Map();
    const guardians = await this.tx.findBy(Guardian, { userId: In(userIds) });
    return new Map(
      guardians.map((guardian) => [guardian.userId!, guardian.preferredLocale]),
    );
  }

  /** Guardians with an account, and the language they chose for school mail. */
  async guardianAccounts(
    studentIds: string[],
  ): Promise<{ studentId: string; userId: string; locale: string }[]> {
    if (studentIds.length === 0) return [];
    const rows = await this.tx.query<
      { student_id: string; user_id: string; preferred_locale: string }[]
    >(
      `SELECT l.student_id, g.user_id, g.preferred_locale FROM guardian_links l
         JOIN guardians g ON g.id = l.guardian_id
        WHERE l.student_id = ANY($1) AND g.user_id IS NOT NULL`,
      [studentIds],
    );
    return rows.map((row) => ({
      studentId: row.student_id,
      userId: row.user_id,
      locale: row.preferred_locale,
    }));
  }

  // ── For billing ─────────────────────────────────────────────────────

  /** Active students with what billing needs: grade and family. */
  async billableStudents(): Promise<
    {
      id: string;
      name: string;
      gradeLevelId: string | null;
      familyId: string | null;
    }[]
  > {
    const students = await this.tx.find(Student, {
      where: { status: 'active' },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
    return students.map((student) => ({
      id: student.id,
      name: `${student.preferredName ?? student.firstName} ${student.lastName}`,
      gradeLevelId: student.gradeLevelId,
      familyId: student.familyId,
    }));
  }

  async familyNames(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const families = await this.tx.findBy(Family, {
      id: In([...new Set(ids)]),
    });
    return new Map(families.map((family) => [family.id, family.name]));
  }

  async allFamilies(): Promise<{ id: string; name: string }[]> {
    const families = await this.tx.find(Family, { order: { name: 'ASC' } });
    return families.map((family) => ({ id: family.id, name: family.name }));
  }

  /** The families the signed-in guardian belongs to. */
  async familyIdsForUser(userId: string): Promise<string[]> {
    const guardians = await this.tx.findBy(Guardian, { userId });
    return [
      ...new Set(
        guardians.flatMap((guardian) =>
          guardian.familyId ? [guardian.familyId] : [],
        ),
      ),
    ];
  }

  /** Guardians of a family who have an account, with the language they chose. */
  async familyAccounts(
    familyId: string,
  ): Promise<{ userId: string; locale: string }[]> {
    const guardians = await this.tx.findBy(Guardian, { familyId });
    return guardians.flatMap((guardian) =>
      guardian.userId
        ? [{ userId: guardian.userId, locale: guardian.preferredLocale }]
        : [],
    );
  }

  /** Erasure: database cascades remove the student's records in every module. */
  async deleteStudent(id: string): Promise<void> {
    await this.tx.delete(Student, { id });
  }

  async deleteGuardiansWithoutStudents(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.tx.query(
      `DELETE FROM guardians g WHERE g.id = ANY($1) AND NOT EXISTS (SELECT 1 FROM guardian_links l WHERE l.guardian_id = g.id)`,
      [ids],
    );
  }

  /** Who should hear about a student: their own account and their guardians' accounts. */
  async accountUserIds(studentIds: string[]): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>(studentIds.map((id) => [id, []]));
    if (studentIds.length === 0) return result;
    const rows = await this.tx.query<{ student_id: string; user_id: string }[]>(
      `SELECT s.id AS student_id, s.user_id FROM students s WHERE s.id = ANY($1) AND s.user_id IS NOT NULL
       UNION
       SELECT l.student_id, g.user_id FROM guardian_links l JOIN guardians g ON g.id = l.guardian_id
        WHERE l.student_id = ANY($1) AND g.user_id IS NOT NULL`,
      [studentIds],
    );
    for (const row of rows) result.get(row.student_id)?.push(row.user_id);
    return result;
  }

  /** Classes the student is enrolled in now. */
  async currentClassIds(studentId: string): Promise<string[]> {
    const enrolments = await this.tx.findBy(Enrolment, {
      studentId,
      endsOn: IsNull(),
    });
    return enrolments.map((enrolment) => enrolment.classId);
  }

  /** The student record of a signed-in student, if they are one. */
  async studentIdForUser(userId: string): Promise<string | null> {
    return (await this.tx.findOneBy(Student, { userId }))?.id ?? null;
  }

  async findStudent(id: string): Promise<Student> {
    const student = await this.tx.findOneBy(Student, { id });
    if (!student) throw new NotFoundException();
    return student;
  }

  findStudentByNumber(studentNumber: string) {
    return this.tx
      .createQueryBuilder(Student, 'student')
      .where('lower(student.student_number) = lower(:studentNumber)', {
        studentNumber,
      })
      .getOne();
  }

  /** Creates the student, or updates the one with this student number. Used by imports. */
  async upsertStudent(dto: CreateStudentDto): Promise<Student> {
    const existing = await this.findStudentByNumber(dto.studentNumber);
    if (!existing) return this.createStudent(dto);
    Object.assign(
      existing,
      pick(dto, [
        'firstName',
        'lastName',
        'preferredName',
        'dateOfBirth',
        'gradeLevelId',
      ]),
    );
    if (dto.email) existing.email = dto.email.toLowerCase();
    return this.tx.save(existing);
  }

  async studentsByIds(ids: string[]): Promise<StudentSummary[]> {
    if (ids.length === 0) return [];
    return this.summaries(await this.tx.findBy(Student, { id: In(ids) }));
  }

  // ── Guardians and families ──────────────────────────────────────────

  async listGuardians({
    search,
  }: ListGuardiansQueryDto): Promise<GuardianSummary[]> {
    const query = this.tx
      .createQueryBuilder(Guardian, 'guardian')
      .orderBy('guardian.last_name')
      .addOrderBy('guardian.first_name')
      .take(200);
    if (search) {
      const term = `%${search.replace(/[%_\\]/g, '\\$&')}%`;
      query.where(
        new Brackets((where) =>
          where
            .where('guardian.first_name ILIKE :term', { term })
            .orWhere('guardian.last_name ILIKE :term', { term })
            .orWhere('guardian.email ILIKE :term', { term }),
        ),
      );
    }
    return (await query.getMany()).map(guardianSummary);
  }

  async getGuardian(id: string) {
    const guardian = await this.findGuardian(id);
    const links = await this.tx.findBy(GuardianLink, { guardianId: id });
    const students = await this.studentsByIds(
      links.map((link) => link.studentId),
    );
    return {
      ...guardianSummary(guardian),
      familyId: guardian.familyId,
      students: students.map((student) => ({
        ...student,
        relationship: links.find((link) => link.studentId === student.id)!
          .relationship,
      })),
    };
  }

  async createGuardian(dto: CreateGuardianDto): Promise<GuardianSummary> {
    const email = dto.email.toLowerCase();
    const guardian = await this.tx.save(
      this.tx.create(Guardian, {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email,
        phone: dto.phone ?? null,
        preferredLocale: dto.preferredLocale ?? 'en',
        userId: await this.memberIdByEmail(email),
      }),
    );
    return guardianSummary(guardian);
  }

  async updateGuardian(
    id: string,
    dto: UpdateGuardianDto,
  ): Promise<GuardianSummary> {
    const guardian = await this.findGuardian(id);
    Object.assign(
      guardian,
      pick(dto, ['firstName', 'lastName', 'phone', 'preferredLocale']),
    );
    if (dto.email) guardian.email = dto.email.toLowerCase();
    return guardianSummary(await this.tx.save(guardian));
  }

  /** Creates the guardian, or updates the one with this email. Used by imports. */
  async upsertGuardian(dto: CreateGuardianDto): Promise<Guardian> {
    const existing = await this.tx.findOneBy(Guardian, {
      email: dto.email.toLowerCase(),
    });
    if (!existing)
      return this.findGuardian((await this.createGuardian(dto)).id);
    Object.assign(
      existing,
      pick(dto, ['firstName', 'lastName', 'phone', 'preferredLocale']),
    );
    return this.tx.save(existing);
  }

  async findGuardian(id: string): Promise<Guardian> {
    const guardian = await this.tx.findOneBy(Guardian, { id });
    if (!guardian) throw new NotFoundException();
    return guardian;
  }

  /**
   * Links a guardian to a student and keeps them in one family: whoever has a
   * family brings the other in; with neither, a family is created. Two
   * different families stay separate until someone merges them.
   */
  async linkGuardian(studentId: string, dto: LinkGuardianDto): Promise<void> {
    const [student, guardian] = await Promise.all([
      this.findStudent(studentId),
      this.findGuardian(dto.guardianId),
    ]);

    if (!student.familyId && !guardian.familyId) {
      const family = await this.tx.save(
        this.tx.create(Family, { name: `${student.lastName} family` }),
      );
      student.familyId = family.id;
      guardian.familyId = family.id;
    } else {
      student.familyId ??= guardian.familyId;
      guardian.familyId ??= student.familyId;
    }
    await this.tx.save([student, guardian]);

    await this.tx
      .createQueryBuilder()
      .insert()
      .into(GuardianLink)
      .values({
        id: uuidv7(),
        guardianId: guardian.id,
        studentId,
        relationship: dto.relationship,
        isPrimaryContact: dto.isPrimaryContact ?? false,
      })
      .orUpdate(
        ['relationship', 'is_primary_contact'],
        ['guardian_id', 'student_id'],
      )
      .execute();
    await this.audit.record({
      action: 'guardian.linked',
      entityType: 'student',
      entityId: studentId,
      after: { guardianId: guardian.id, relationship: dto.relationship },
    });
  }

  async unlinkGuardian(studentId: string, guardianId: string): Promise<void> {
    const result = await this.tx.delete(GuardianLink, {
      studentId,
      guardianId,
    });
    if (!result.affected) throw new NotFoundException();
    await this.audit.record({
      action: 'guardian.unlinked',
      entityType: 'student',
      entityId: studentId,
      before: { guardianId },
    });
  }

  async getFamily(id: string) {
    const family = await this.tx.findOneBy(Family, { id });
    if (!family) throw new NotFoundException();
    const [guardians, students] = await Promise.all([
      this.tx.findBy(Guardian, { familyId: id }),
      this.tx.findBy(Student, { familyId: id }),
    ]);
    return {
      id: family.id,
      name: family.name,
      guardians: guardians.map(guardianSummary),
      students: await this.summaries(students),
    };
  }

  async renameFamily(id: string, name: string) {
    const result = await this.tx.update(Family, { id }, { name });
    if (!result.affected) throw new NotFoundException();
    return this.getFamily(id);
  }

  // ── Enrolments ──────────────────────────────────────────────────────

  async roster(classId: string): Promise<StudentSummary[]> {
    await this.policy.assertClassAccess(classId);
    const enrolments = await this.tx.findBy(Enrolment, {
      classId,
      endsOn: IsNull(),
    });
    const students = await this.studentsByIds(
      enrolments.map((enrolment) => enrolment.studentId),
    );
    return students.sort(
      (a, b) =>
        a.lastName.localeCompare(b.lastName) ||
        a.firstName.localeCompare(b.firstName),
    );
  }

  async enrol(
    classId: string,
    { studentIds, startsOn }: EnrolStudentsDto,
  ): Promise<void> {
    await this.academics.findClass(classId);
    const unique = [...new Set(studentIds)];
    const found = await this.tx.countBy(Student, {
      id: In(unique),
      status: 'active',
    });
    if (found !== unique.length) {
      throw new ProblemException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'student_not_found',
        'Unknown or withdrawn student',
      );
    }
    const start = startsOn ?? (await this.clock.today());
    await this.tx
      .createQueryBuilder()
      .insert()
      .into(Enrolment)
      .values(
        unique.map((studentId) => ({
          id: uuidv7(),
          studentId,
          classId,
          startsOn: start,
          endsOn: null,
        })),
      )
      .orIgnore()
      .execute();
    await this.audit.record({
      action: 'class.enrolled',
      entityType: 'class',
      entityId: classId,
      after: { studentIds: unique },
    });
  }

  /** Ends the enrolment today, keeping the history. An enrolment started today is simply removed. */
  async unenrol(classId: string, studentId: string): Promise<void> {
    const enrolment = await this.tx.findOneBy(Enrolment, {
      classId,
      studentId,
      endsOn: IsNull(),
    });
    if (!enrolment) throw new NotFoundException();
    const today = await this.clock.today();
    if (enrolment.startsOn >= today)
      await this.tx.delete(Enrolment, { id: enrolment.id });
    else
      await this.tx.update(Enrolment, { id: enrolment.id }, { endsOn: today });
    await this.audit.record({
      action: 'class.unenrolled',
      entityType: 'class',
      entityId: classId,
      before: { studentId },
    });
  }

  // ── Accounts ────────────────────────────────────────────────────────

  /** Connects a new member's account to the guardian and student records with their email. */
  // ── Admissions ──────────────────────────────────────────────────────

  /**
   * The family an applicant is billed as. An existing guardian with this email
   * keeps their family, so siblings share one account (ADMS-11).
   */
  async ensureApplicantFamily(input: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    locale: string;
  }): Promise<{ guardianId: string; familyId: string }> {
    const email = input.email.toLowerCase();
    let guardian = await this.tx.findOneBy(Guardian, { email });
    guardian ??= this.tx.create(Guardian, {
      firstName: input.firstName,
      lastName: input.lastName,
      email,
      phone: input.phone,
      preferredLocale: input.locale === 'fr' ? 'fr' : 'en',
      userId: input.userId,
    });
    guardian.userId ??= input.userId;
    if (!guardian.familyId) {
      const family = await this.tx.save(
        this.tx.create(Family, { name: `${guardian.lastName} family` }),
      );
      guardian.familyId = family.id;
    }
    guardian = await this.tx.save(guardian);
    return { guardianId: guardian.id, familyId: guardian.familyId! };
  }

  /** The student record for an accepted applicant, linked to their guardian's family. */
  async admitStudent(input: {
    studentNumber: string;
    firstName: string;
    lastName: string;
    preferredName: string | null;
    dateOfBirth: string | null;
    gradeLevelId: string;
    guardianId: string;
    relationship: Relationship;
  }): Promise<Student> {
    const student = await this.createStudent({
      studentNumber: input.studentNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      preferredName: input.preferredName,
      dateOfBirth: input.dateOfBirth,
      gradeLevelId: input.gradeLevelId,
    });
    await this.linkGuardian(student.id, {
      guardianId: input.guardianId,
      relationship: input.relationship,
      isPrimaryContact: true,
    });
    await this.audit.record({
      action: 'student.admitted',
      entityType: 'student',
      entityId: student.id,
      after: { gradeLevelId: input.gradeLevelId },
    });
    return this.findStudent(student.id);
  }

  /** The record is kept; class places end on the leaving date (ADMS-14). */
  async withdraw(
    studentId: string,
    leavingOn: string,
    reason: string,
  ): Promise<void> {
    const student = await this.findStudent(studentId);
    if (student.status === 'withdrawn') {
      throw new ProblemException(
        HttpStatus.CONFLICT,
        'already_withdrawn',
        'The student has already left',
      );
    }
    Object.assign(student, {
      status: 'withdrawn',
      withdrawnOn: leavingOn,
      withdrawalReason: reason,
    });
    await this.tx.save(student);
    await this.tx
      .createQueryBuilder()
      .update(Enrolment)
      .set({ endsOn: leavingOn })
      .where(
        'student_id = :studentId AND (ends_on IS NULL OR ends_on > :leavingOn)',
        { studentId, leavingOn },
      )
      .execute();
    await this.audit.record({
      action: 'student.withdrawn',
      entityType: 'student',
      entityId: studentId,
      after: { leavingOn, reason },
    });
  }

  async setGradeLevel(studentId: string, gradeLevelId: string): Promise<void> {
    await this.tx.update(Student, { id: studentId }, { gradeLevelId });
  }

  /** Students the signed-in guardian may answer for. */
  async guardedStudentIds(userId: string): Promise<string[]> {
    const rows = await this.tx.query<{ student_id: string }[]>(
      `SELECT l.student_id FROM guardian_links l JOIN guardians g ON g.id = l.guardian_id WHERE g.user_id = $1`,
      [userId],
    );
    return rows.map((row) => row.student_id);
  }

  async linkAccount(userId: string, email: string): Promise<void> {
    const normalized = email.toLowerCase();
    await this.tx.update(
      Guardian,
      { email: normalized, userId: IsNull() },
      { userId },
    );
    await this.tx.update(
      Student,
      { email: normalized, userId: IsNull() },
      { userId },
    );
  }

  private async memberIdByEmail(email: string): Promise<string | null> {
    return (
      (await this.academics.membersByEmail([email])).get(email.toLowerCase()) ??
      null
    );
  }

  private async summaries(students: Student[]): Promise<StudentSummary[]> {
    const levels = await this.academics.gradeLevelsByIds(
      students.map((student) => student.gradeLevelId),
    );
    return students.map((student) => {
      const level = levels.find(
        (candidate) => candidate.id === student.gradeLevelId,
      );
      return {
        id: student.id,
        studentNumber: student.studentNumber,
        firstName: student.firstName,
        lastName: student.lastName,
        preferredName: student.preferredName,
        status: student.status,
        gradeLevel: level ? { id: level.id, name: level.name } : null,
      };
    });
  }
}

function guardianSummary(guardian: Guardian): GuardianSummary {
  return {
    id: guardian.id,
    firstName: guardian.firstName,
    lastName: guardian.lastName,
    email: guardian.email,
    phone: guardian.phone,
    preferredLocale: guardian.preferredLocale,
    hasAccount: guardian.userId !== null,
  };
}
