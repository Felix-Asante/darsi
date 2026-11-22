import { Global, Module } from '@nestjs/common';
import { RequestContext } from './request-context.js';
import { TenantTransactions } from './tenant-transactions.js';

@Global()
@Module({
  providers: [RequestContext, TenantTransactions],
  exports: [RequestContext, TenantTransactions],
})
export class TenancyModule {}
