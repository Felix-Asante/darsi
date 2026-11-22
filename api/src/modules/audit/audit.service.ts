import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import type { QueryDeepPartialEntity } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { RequestContext } from '../../common/tenancy/request-context.js';
import { diffSnapshots } from './audit-diff.js';
import { AuditEvent } from './audit-event.entity.js';

export interface AuditRecord {
  action: string;
  entityType: string;
  entityId?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly context: RequestContext,
  ) {}

  /** Writes in the caller's transaction, so the event commits or rolls back with the change. */
  async record({
    action,
    entityType,
    entityId,
    before,
    after,
  }: AuditRecord): Promise<void> {
    const event: QueryDeepPartialEntity<AuditEvent> = {
      id: uuidv7(),
      action,
      entityType,
      entityId: entityId ?? null,
      actorId: this.context.userId ?? null,
      requestId: this.context.requestId ?? null,
      diff: diffSnapshots(
        before,
        after,
      ) as QueryDeepPartialEntity<AuditEvent>['diff'],
    };
    await this.txHost.tx.insert(AuditEvent, event);
  }
}
