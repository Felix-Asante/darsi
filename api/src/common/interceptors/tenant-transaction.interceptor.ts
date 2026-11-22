import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, lastValueFrom, type Observable } from 'rxjs';
import { TenantTransactions } from '../tenancy/tenant-transactions.js';

const WITHOUT_TRANSACTION = 'withoutTransaction';

/** For routes that must not touch the database, such as the liveness probe. */
export const WithoutTransaction = () => SetMetadata(WITHOUT_TRANSACTION, true);

@Injectable()
export class TenantTransactionInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly transactions: TenantTransactions,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(
      WITHOUT_TRANSACTION,
      [context.getHandler(), context.getClass()],
    );
    if (skip) return next.handle();

    return from(
      this.transactions.run(() =>
        lastValueFrom(next.handle(), { defaultValue: undefined }),
      ),
    );
  }
}
