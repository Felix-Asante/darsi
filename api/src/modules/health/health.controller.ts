import { Controller, Get, Inject } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import type { Redis } from 'ioredis';
import { WithoutTransaction } from '../../common/interceptors/tenant-transaction.interceptor.js';
import { REDIS } from '../../common/redis/redis.module.js';
import { Public } from '../auth/auth.decorators.js';

@Controller('health')
@Public()
@SkipThrottle()
@WithoutTransaction()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly indicators: HealthIndicatorService,
    private readonly db: TypeOrmHealthIndicator,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([]);
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 1000 }),
      () => this.pingRedis(),
    ]);
  }

  private async pingRedis() {
    const indicator = this.indicators.check('redis');
    try {
      await this.redis.ping();
      return indicator.up();
    } catch (error) {
      return indicator.down({
        message: error instanceof Error ? error.message : 'unreachable',
      });
    }
  }
}
