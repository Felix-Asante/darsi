import dataSource from './data-source.js';

await dataSource.initialize();
try {
  const applied = await dataSource.runMigrations();
  console.log(
    applied.length
      ? `Applied ${applied.length} migration(s): ${applied.map((migration) => migration.name).join(', ')}`
      : 'Database is up to date',
  );
} finally {
  await dataSource.destroy();
}
