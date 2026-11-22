import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { parseArgs } from 'node:util';
import { CoreModule } from '../core.module.js';
import { CreateSchoolDto } from '../modules/schools/dto/school-settings.dto.js';
import { SchoolsModule } from '../modules/schools/schools.module.js';
import { SchoolsService } from '../modules/schools/schools.service.js';

@Module({ imports: [CoreModule.register({ relay: false }), SchoolsModule] })
class CliModule {}

const { values } = parseArgs({
  options: {
    name: { type: 'string' },
    slug: { type: 'string' },
    'admin-name': { type: 'string' },
    'admin-email': { type: 'string' },
    locale: { type: 'string', default: 'en' },
    'time-zone': { type: 'string', default: 'Europe/Paris' },
    currency: { type: 'string', default: 'EUR' },
  },
});

const dto = plainToInstance(CreateSchoolDto, {
  name: values.name,
  slug: values.slug,
  adminName: values['admin-name'],
  adminEmail: values['admin-email'],
  defaultLocale: values.locale,
  timeZone: values['time-zone'],
  currency: values.currency,
});
const errors = validateSync(dto);
if (errors.length > 0) {
  console.error(
    'Usage: npm run school:create -- --name "Greenfield School" --slug greenfield \\',
  );
  console.error(
    '         --admin-name "Ada Admin" --admin-email ada@example.com [--locale fr] [--time-zone Europe/Paris] [--currency EUR]',
  );
  for (const error of errors)
    console.error(
      `  ${error.property}: ${Object.values(error.constraints ?? {}).join(', ')}`,
    );
  process.exit(1);
}

const app = await NestFactory.createApplicationContext(CliModule, {
  logger: ['error', 'warn'],
});
try {
  const school = await app.get(SchoolsService).create(dto);
  console.log(
    `Created ${school.name} (${school.slug}). ${dto.adminEmail} will receive a link to choose a password.`,
  );
} finally {
  await app.close();
}
