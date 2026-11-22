import { type DynamicModule, Module } from '@nestjs/common';
import { OutboxModule, OutboxStorage } from '@nestjs/outbox';
import { fromTypeOrm, PostgresOutboxStore } from '@nestjs/outbox/postgres';
import { DataSource } from 'typeorm';

export interface OutboxPlatformOptions {
  /** Only the worker publishes; API instances only add messages. */
  relay: boolean;
}

@Module({})
export class OutboxPlatformModule {
  static register({ relay }: OutboxPlatformOptions): DynamicModule {
    return {
      module: OutboxPlatformModule,
      imports: [
        OutboxModule.forRootAsync({
          useFactory: () => ({
            relay: { enabled: relay, pollInterval: '1s', lease: '30s' },
            retry: { attempts: 10, backoff: { delay: '1s', maxDelay: '5m' } },
          }),
        }),
      ],
      providers: [
        {
          provide: PostgresOutboxStore,
          inject: [DataSource, OutboxStorage],
          useFactory: (dataSource: DataSource, storage: OutboxStorage) =>
            new PostgresOutboxStore(
              { executor: fromTypeOrm(dataSource), migrate: false },
              storage,
            ),
        },
      ],
    };
  }
}
