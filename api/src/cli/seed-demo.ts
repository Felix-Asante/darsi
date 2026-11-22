import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { parseArgs } from 'node:util';
import { CoreModule } from '../core.module.js';
import { AcademicsModule } from '../modules/academics/academics.module.js';
import { AssessmentModule } from '../modules/assessment/assessment.module.js';
import { CurriculumModule } from '../modules/curriculum/curriculum.module.js';
import { ImportRows } from '../modules/imports/import-rows.js';
import { PeopleModule } from '../modules/people/people.module.js';
import { SchoolsModule } from '../modules/schools/schools.module.js';
import { TimetablesModule } from '../modules/timetables/timetables.module.js';
import { seedDemoSchool } from './demo-seed.js';

@Module({
  imports: [
    CoreModule.register({ relay: false }),
    SchoolsModule,
    AcademicsModule,
    PeopleModule,
    CurriculumModule,
    TimetablesModule,
    AssessmentModule,
  ],
  providers: [ImportRows],
})
class SeedModule {}

const { values } = parseArgs({
  options: {
    slug: { type: 'string', default: 'demo' },
    'admin-email': { type: 'string', default: 'admin@demo.darsi.test' },
  },
});

const app = await NestFactory.createApplicationContext(SeedModule, {
  logger: ['error', 'warn'],
});
try {
  const { created } = await seedDemoSchool(app, {
    slug: values.slug,
    adminEmail: values['admin-email'],
    log: (line) => console.log(line),
  });
  console.log(
    created
      ? `Created ${values.slug}. ${values['admin-email']} will receive a link to choose a password; run the worker to send it.`
      : `Updated ${values.slug}.`,
  );
} finally {
  await app.close();
}
