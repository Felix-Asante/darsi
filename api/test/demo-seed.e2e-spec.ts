import type { INestApplication } from '@nestjs/common';
import { seedDemoSchool } from '../src/cli/demo-seed.js';
import { createTestApp } from './support/create-test-app.js';
import {
  choosePassword,
  signIn,
  uniqueEmail,
  uniqueSlug,
} from './support/identity.js';

describe('Demo school seed (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a bilingual school with classes and families, and changes nothing when run again', async () => {
    const slug = uniqueSlug('demo');
    const adminEmail = uniqueEmail('admin');

    const first = await seedDemoSchool(app, { slug, adminEmail });
    expect(first.created).toBe(true);
    await choosePassword(app, adminEmail);
    const admin = await signIn(app, adminEmail);

    const countStudents = async () => {
      let total = 0;
      let cursor: string | null = null;
      do {
        const {
          body,
        }: { body: { items: unknown[]; nextCursor: string | null } } =
          await admin
            .get(
              `/api/v1/students?limit=200${cursor ? `&cursor=${cursor}` : ''}`,
            )
            .expect(200);
        total += body.items.length;
        cursor = body.nextCursor;
      } while (cursor);
      return total;
    };

    const students = await countStudents();
    expect(students).toBeGreaterThan(40);
    const { body: classes } = await admin
      .get('/api/v1/academics/classes')
      .expect(200);
    expect(classes).toHaveLength(15);
    expect(
      classes.find(
        (schoolClass: { code: string }) => schoolClass.code === 'MATH7A',
      ).staff,
    ).toEqual([expect.objectContaining({ role: 'teacher' })]);
    const { body: guardians } = await admin
      .get('/api/v1/guardians')
      .expect(200);
    expect(
      new Set(
        guardians.map(
          (guardian: { preferredLocale: string }) => guardian.preferredLocale,
        ),
      ),
    ).toEqual(new Set(['en', 'fr']));

    const { body: lessons } = await admin
      .get(
        '/api/v1/timetables/classes/' +
          classes[0].id +
          '?from=2026-11-16&to=2026-11-20',
      )
      .expect(200);
    expect(lessons).toHaveLength(5);

    const again = await seedDemoSchool(app, { slug, adminEmail });
    expect(again).toEqual({ schoolId: first.schoolId, created: false });
    expect(await countStudents()).toBe(students);
    const { body: classesAgain } = await admin
      .get('/api/v1/academics/classes')
      .expect(200);
    expect(classesAgain).toHaveLength(15);
  }, 120_000);
});
