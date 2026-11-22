import { ForbiddenException, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { RequestContext } from '../../common/tenancy/request-context.js';
import { type Role, rolesAllow } from '../auth/access-control.js';
import type { ClassStaffRole } from '../academics/entities/class-staff.entity.js';

export interface Audience {
  classIds: string[];
  gradeLevelIds: string[];
  divisionIds: string[];
}

/** Staff who see every class and student in the school, not only their own. */
const SCHOOL_WIDE: Role[] = ['admin', 'coordinator'];

/**
 * Resource-scoped checks that roles alone can't answer: is this teacher
 * assigned to this class, is this guardian linked to this student. It reads
 * the relationship tables directly so every module can depend on it.
 */
@Injectable()
export class PolicyService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly context: RequestContext,
  ) {}

  get isSchoolWide(): boolean {
    return this.context.hasRole(...SCHOOL_WIDE);
  }

  async classRole(
    classId: string,
    userId = this.context.requireUserId(),
  ): Promise<ClassStaffRole | null> {
    const [row] = await this.txHost.tx.query<{ role: ClassStaffRole }[]>(
      `SELECT role FROM class_staff WHERE class_id = $1 AND user_id = $2`,
      [classId, userId],
    );
    return row?.role ?? null;
  }

  /** Admins and coordinators always pass; others must hold one of `roles` in the class. */
  async assertClassAccess(
    classId: string,
    roles: ClassStaffRole[] = ['teacher', 'teaching_assistant', 'class_member'],
  ) {
    if (this.isSchoolWide) return;
    const role = await this.classRole(classId);
    if (!role || !roles.includes(role)) throw new ForbiddenException();
  }

  /** Classes the user works in, for "my classes" views. */
  async classIdsForUser(
    userId = this.context.requireUserId(),
  ): Promise<string[]> {
    const rows = await this.txHost.tx.query<{ class_id: string }[]>(
      `SELECT class_id FROM class_staff WHERE user_id = $1`,
      [userId],
    );
    return rows.map((row) => row.class_id);
  }

  /** Students linked to the signed-in guardian, and the signed-in student themself. */
  async ownStudentIds(
    userId = this.context.requireUserId(),
  ): Promise<string[]> {
    const rows = await this.txHost.tx.query<{ id: string }[]>(
      `SELECT s.id FROM students s WHERE s.user_id = $1
       UNION
       SELECT l.student_id FROM guardian_links l JOIN guardians g ON g.id = l.guardian_id WHERE g.user_id = $1`,
      [userId],
    );
    return rows.map((row) => row.id);
  }

  /**
   * The classes, grade levels and divisions the user belongs to: those they
   * work in, and those of their own students. Decides who sees targeted events.
   */
  async audience(userId = this.context.requireUserId()): Promise<Audience> {
    const studentIds = await this.ownStudentIds(userId);
    const [row] = await this.txHost.tx.query<
      {
        class_ids: string[];
        grade_level_ids: string[];
        division_ids: string[];
      }[]
    >(
      `WITH my_classes AS (
         SELECT class_id FROM class_staff WHERE user_id = $1
         UNION
         SELECT class_id FROM enrolments WHERE student_id = ANY($2) AND ends_on IS NULL
       ),
       my_levels AS (
         SELECT c.grade_level_id AS id FROM classes c JOIN my_classes m ON m.class_id = c.id WHERE c.grade_level_id IS NOT NULL
         UNION
         SELECT grade_level_id FROM students WHERE id = ANY($2) AND grade_level_id IS NOT NULL
       )
       SELECT
         COALESCE((SELECT array_agg(class_id) FROM my_classes), '{}') AS class_ids,
         COALESCE((SELECT array_agg(id) FROM my_levels), '{}') AS grade_level_ids,
         COALESCE((SELECT array_agg(DISTINCT g.division_id) FROM grade_levels g JOIN my_levels l ON l.id = g.id), '{}') AS division_ids`,
      [userId, studentIds],
    );
    return {
      classIds: row.class_ids,
      gradeLevelIds: row.grade_level_ids,
      divisionIds: row.division_ids,
    };
  }

  /** Members of the current school, optionally only those holding `role`. */
  async memberUserIds(role?: Role): Promise<string[]> {
    const rows = await this.txHost.tx.query<
      { user_id: string; role: string }[]
    >(`SELECT user_id, role FROM members WHERE organization_id = $1`, [
      this.context.requireSchoolId(),
    ]);
    return rows
      .filter(
        (row) =>
          !role ||
          row.role
            .split(',')
            .map((value) => value.trim())
            .includes(role),
      )
      .map((row) => row.user_id);
  }

  /** Staff with directory access see any student; families see only their own. */
  async assertStudentAccess(studentId: string): Promise<void> {
    if (rolesAllow(this.context.roles, { people: ['read'] })) return;
    const own = await this.ownStudentIds();
    if (!own.includes(studentId)) throw new ForbiddenException();
  }
}
