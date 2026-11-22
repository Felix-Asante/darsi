import pg from 'pg';
import type { DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from './snake-naming.strategy.js';

// A calendar date (term start, due date, birthday) has no time zone; keep it as `YYYY-MM-DD`.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

export function buildDataSourceOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
    migrationsRun: false,
  };
}
