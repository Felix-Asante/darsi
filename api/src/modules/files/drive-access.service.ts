import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In } from 'typeorm';
import { RequestContext } from '../../common/tenancy/request-context.js';
import { PeopleService } from '../people/people.service.js';
import { PolicyService } from '../policies/policy.service.js';
import { type DriveAudience, DriveItem } from './entities/files.entities.js';

export interface DriveAccess {
  /** Sees every item: the class's staff and school-wide staff. */
  seesAll: boolean;
  /** Uploads, renames and moves (DRV-2). */
  manage: boolean;
  /** Deletes: the class's teachers only (DRV-2). */
  delete: boolean;
  /** Audiences the user belongs to for items not visible to everyone. */
  audiences: DriveAudience[];
}

/**
 * Who sees what in a class drive, decided afresh on every request from current
 * class staff and enrolments, so access ends the moment a student leaves (DRV-3).
 */
@Injectable()
export class DriveAccessService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly context: RequestContext,
    private readonly policy: PolicyService,
    private readonly people: PeopleService,
  ) {}

  async forClass(classId: string): Promise<DriveAccess> {
    const role = await this.policy.classRole(classId);
    const isStaff = role === 'teacher' || role === 'teaching_assistant';
    const audiences: DriveAudience[] =
      role === 'class_member' ? ['class_member'] : [];

    const userId = this.context.requireUserId();
    const own = await this.policy.ownStudentIds(userId);
    if (own.length > 0) {
      const self = await this.people.studentIdForUser(userId);
      for (const studentId of own) {
        if (!(await this.people.currentClassIds(studentId)).includes(classId))
          continue;
        audiences.push(studentId === self ? 'student' : 'guardian');
      }
    }
    return {
      seesAll: isStaff || this.policy.isSchoolWide,
      manage: isStaff,
      delete: role === 'teacher',
      audiences: [...new Set(audiences)],
    };
  }

  /** The item and every folder above it must be visible to the user. */
  async canSee(item: DriveItem, access: DriveAccess): Promise<boolean> {
    if (access.seesAll) return true;
    for (const node of await this.ancestry(item)) {
      if (
        !node.visibility.some((audience) => access.audiences.includes(audience))
      )
        return false;
    }
    return true;
  }

  /** The item and its parents, nearest first. */
  async ancestry(item: DriveItem): Promise<DriveItem[]> {
    const chain = [item];
    let parentId = item.parentId;
    while (parentId) {
      const parent = await this.txHost.tx.findOneBy(DriveItem, {
        id: parentId,
      });
      if (!parent) break;
      chain.push(parent);
      parentId = parent.parentId;
    }
    return chain;
  }

  /** Every item below these, for moves (no cycles) and deletes. */
  async descendantIds(ids: string[]): Promise<string[]> {
    const result: string[] = [];
    let frontier = ids;
    while (frontier.length > 0) {
      const children = await this.txHost.tx.findBy(DriveItem, {
        parentId: In(frontier),
      });
      frontier = children.map((child) => child.id);
      result.push(...frontier);
    }
    return result;
  }
}
