import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { ClsService } from 'nestjs-cls';
import { RequestContext, type RequestContextStore } from './request-context.js';

@Injectable()
export class TenantTransactions {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly cls: ClsService<RequestContextStore>,
    private readonly context: RequestContext,
  ) {}

  /** Runs `work` in one transaction scoped to the current school, if one is set. */
  run<T>(work: () => Promise<T>): Promise<T> {
    return this.txHost.withTransaction(async () => {
      const schoolId = this.context.schoolId;
      if (schoolId) {
        await this.txHost.tx.query(
          `SELECT set_config('app.school_id', $1, true)`,
          [schoolId],
        );
      }
      return work();
    });
  }

  /** For code outside an HTTP request, such as queue jobs and tests. */
  runInSchool<T>(schoolId: string, work: () => Promise<T>): Promise<T> {
    return this.cls.run(() => {
      this.context.setSchool(schoolId);
      return this.run(work);
    });
  }
}
