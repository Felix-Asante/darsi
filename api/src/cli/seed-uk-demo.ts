import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { parseArgs } from 'node:util';
import { CoreModule } from '../core.module.js';
import { FEATURE_MODULES } from '../feature-modules.js';
import { seedUkDemo } from './uk-demo-seed.js';

@Module({
  imports: [CoreModule.register({ relay: false }), ...FEATURE_MODULES],
})
class SeedModule {}

const { values } = parseArgs({ options: { slug: { type: 'string' } } });
if (!values.slug) {
  console.error('Usage: node dist/cli/seed-uk-demo.js --slug <school slug>');
  process.exit(1);
}

const app = await NestFactory.createApplicationContext(SeedModule, {
  logger: ['error', 'warn'],
});
try {
  console.log(`Seeding ${values.slug}:`);
  const { students, families } = await seedUkDemo(app, {
    slug: values.slug,
    log: (line) => console.log(line),
  });
  console.log(`Done: ${students} students in ${families} families.`);
} finally {
  await app.close();
}
