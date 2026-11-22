import { existsSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './typeorm.options.js';

// Same files and precedence as ConfigModule; variables already set win.
for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const url = process.env.DATABASE_MIGRATOR_URL ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    'DATABASE_MIGRATOR_URL (or DATABASE_URL) must be set to run migrations',
  );
}

export default new DataSource({
  ...buildDataSourceOptions(url),
  entities: [`${import.meta.dirname}/../**/*.entity.js`],
  migrations: [`${import.meta.dirname}/migrations/*.js`],
  migrationsTransactionMode: 'each',
});
