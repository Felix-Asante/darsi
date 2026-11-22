import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter.js';
import { TenantTransactionInterceptor } from './common/interceptors/tenant-transaction.interceptor.js';
import { CoreModule } from './core.module.js';
import { FEATURE_MODULES } from './feature-modules.js';
import { AuthGuard } from './modules/auth/auth.guard.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [
    CoreModule.register({ relay: false }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    HealthModule,
    ...FEATURE_MODULES,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantTransactionInterceptor },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
export class AppModule {}
