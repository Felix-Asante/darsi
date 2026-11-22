import type { INestApplicationContext } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantTransactions } from '../common/tenancy/tenant-transactions.js';
import { AcademicsService } from '../modules/academics/academics.service.js';
import type { ImportKind } from '../modules/imports/entities/import-job.entity.js';
import { ImportRows } from '../modules/imports/import-rows.js';
import { SchoolsService } from '../modules/schools/schools.service.js';
import { TimetablesService } from '../modules/timetables/timetables.service.js';
import { GradingService } from '../modules/assessment/grading.service.js';

const DIVISIONS = [
  {
    name: 'Primaire / Primary',
    grades: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  },
  {
    name: 'Collège / Middle School',
    grades: ['Grade 6', 'Grade 7', 'Grade 8'],
  },
];
const SUBJECTS = [
  { code: 'MATH', name: 'Mathématiques / Mathematics' },
  { code: 'FR', name: 'Français' },
  { code: 'EN', name: 'English' },
  { code: 'SCI', name: 'Sciences' },
  { code: 'HIST', name: 'Histoire-géographie / History' },
];
const FIRST_NAMES = [
  'Amira',
  'Lucas',
  'Chloé',
  'Noah',
  'Inès',
  'Liam',
  'Léa',
  'Adam',
  'Emma',
  'Yanis',
  'Olivia',
  'Hugo',
  'Sofia',
  'Gabriel',
  'Maya',
  'Ethan',
  'Jade',
  'Rayan',
  'Zoé',
  'Samuel',
];
const FAMILY_NAMES = [
  'Haddad',
  'Martin',
  'Dubois',
  'Smith',
  'Benali',
  'Moreau',
  'Johnson',
  'Laurent',
  'Nguyen',
  'Garcia',
  'Lefèvre',
  'Brown',
  'Mercier',
  'Diallo',
  'Roux',
];
const GUARDIAN_NAMES = [
  'Leila',
  'Sophie',
  'Karim',
  'Claire',
  'David',
  'Nadia',
  'Thomas',
  'Sarah',
  'Julien',
  'Fatima',
  'Marc',
  'Emily',
  'Pierre',
  'Aïcha',
  'Paul',
];

const PERIODS = [
  ['P1', '08:30', '09:25'],
  ['P2', '09:30', '10:25'],
  ['P3', '10:40', '11:35'],
  ['P4', '11:40', '12:35'],
  ['P5', '13:45', '14:40'],
  ['P6', '14:45', '15:40'],
];

const csv = (header: string[], rows: (string | number)[][]) =>
  rows.map((row) =>
    Object.fromEntries(
      header.map((column, index) => [column, String(row[index] ?? '')]),
    ),
  );

function people() {
  const students: string[][] = [];
  const guardians: string[][] = [];
  let number = 1;
  FAMILY_NAMES.forEach((lastName, family) => {
    const children = 2 + (family % 3);
    const numbers: string[] = [];
    for (let child = 0; child < children; child += 1) {
      const grade = 6 + ((family + child) % 3);
      const studentNumber = `D${String(number).padStart(4, '0')}`;
      const day = String(1 + ((number * 7) % 28)).padStart(2, '0');
      const month = String(1 + ((number * 5) % 12)).padStart(2, '0');
      students.push([
        studentNumber,
        FIRST_NAMES[(family * 3 + child) % FIRST_NAMES.length],
        lastName,
        `${2020 - grade}-${month}-${day}`,
        `Grade ${grade}`,
      ]);
      numbers.push(studentNumber);
      number += 1;
    }
    const locale = family % 2 === 0 ? 'fr' : 'en';
    const email = `${GUARDIAN_NAMES[family].normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()}.${lastName.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()}@demo.darsi.test`;
    guardians.push([
      email,
      GUARDIAN_NAMES[family],
      lastName,
      locale,
      numbers.join(';'),
      family % 3 === 0 ? 'father' : 'mother',
    ]);
  });
  return { students, guardians };
}

export interface SeedOptions {
  slug: string;
  adminEmail: string;
  log?: (line: string) => void;
}

/**
 * A realistic bilingual school for demos and local work. Safe to run again:
 * every record is matched by its natural key, as the CSV imports do.
 */
export async function seedDemoSchool(
  app: INestApplicationContext,
  { slug, adminEmail: email, log = () => undefined }: SeedOptions,
): Promise<{ schoolId: string; created: boolean }> {
  const adminEmail = email.toLowerCase();
  const [existing] = await app
    .get(DataSource)
    .query<{ id: string }[]>(`SELECT id FROM organizations WHERE slug = $1`, [
      slug,
    ]);
  const schoolId =
    existing?.id ??
    (
      await app.get(SchoolsService).create({
        name: 'Greenfield International School',
        slug,
        adminName: 'Ada Admin',
        adminEmail,
        defaultLocale: 'fr',
        timeZone: 'Europe/Paris',
        currency: 'EUR',
      })
    ).id;

  const transactions = app.get(TenantTransactions);
  const academics = app.get(AcademicsService);
  const rows = app.get(ImportRows);
  const inSchool = <T>(work: () => Promise<T>) =>
    transactions.runInSchool(schoolId, work);

  await inSchool(async () => {
    if ((await academics.listYears()).length === 0) {
      await academics.createYear({
        name: '2026–2027',
        startsOn: '2026-09-01',
        endsOn: '2027-07-02',
        isCurrent: true,
      });
    }
    const divisions = await academics.listDivisions();
    for (const [order, { name, grades }] of DIVISIONS.entries()) {
      const division =
        divisions.find((candidate) => candidate.name === name) ??
        (await academics.createDivision({ name, sortOrder: order }));
      const existingGrades =
        divisions.find((candidate) => candidate.id === division.id)
          ?.gradeLevels ?? [];
      for (const [sortOrder, grade] of grades.entries()) {
        if (!existingGrades.some((level) => level.name === grade)) {
          await academics.createGradeLevel({
            divisionId: division.id,
            name: grade,
            sortOrder,
          });
        }
      }
    }
    const subjects = await academics.listSubjects();
    for (const subject of SUBJECTS) {
      if (!subjects.some((candidate) => candidate.code === subject.code))
        await academics.createSubject(subject);
    }

    const grading = app.get(GradingService);
    if ((await grading.listScales()).length === 0) {
      const marks = await grading.createScale({
        name: 'Note sur 20',
        preset: 'french_20',
      });
      await grading.createScale({
        name: 'Compétences 1–4 / Standards 1–4',
        preset: 'standards_4',
      });
      await grading.createScale({
        name: 'Letter grades',
        preset: 'us_letters',
      });
      await grading.savePolicy({
        reportingScaleId: marks.id,
        method: 'weighted_average',
        categories: [
          { name: 'Devoirs / Homework', weight: 30 },
          { name: 'Contrôles / Tests', weight: 70 },
        ],
      });
    }

    const timetables = app.get(TimetablesService);
    if ((await timetables.listSchedules()).length === 0) {
      const schedule = await timetables.createSchedule({
        name: 'Horaires / Bell schedule',
        rotationKind: 'weekly',
        rotationLength: 1,
      });
      for (const [name, startsAt, endsAt] of PERIODS) {
        await timetables.createPeriod(schedule.id, { name, startsAt, endsAt });
      }
    }
  });

  const run = async (kind: ImportKind, records: Record<string, string>[]) => {
    for (const record of records)
      await inSchool(() => rows.handle(kind, record));
    log(`  ${kind}: ${records.length}`);
  };
  const { students, guardians } = people();
  const isAdminMember =
    (
      await app
        .get(DataSource)
        .query<unknown[]>(
          `SELECT 1 FROM members m JOIN users u ON u.id = m.user_id WHERE m.organization_id = $1 AND u.email = $2`,
          [schoolId, adminEmail],
        )
    ).length > 0;

  log(`Seeding ${slug}:`);
  await run(
    'students',
    csv(
      [
        'student_number',
        'first_name',
        'last_name',
        'date_of_birth',
        'grade_level',
      ],
      students,
    ),
  );
  await run(
    'guardians',
    csv(
      [
        'email',
        'first_name',
        'last_name',
        'preferred_locale',
        'student_numbers',
        'relationship',
      ],
      guardians,
    ),
  );
  const classes = [6, 7, 8].flatMap((grade) =>
    SUBJECTS.map((subject) => [
      `${subject.code}${grade}A`,
      `${subject.name.split(' / ').pop()} ${grade}A`,
      subject.code,
      `Grade ${grade}`,
      isAdminMember && grade === 7 ? adminEmail : '',
    ]),
  );
  await run(
    'classes',
    csv(
      ['code', 'name', 'subject_code', 'grade_level', 'teacher_emails'],
      classes,
    ),
  );
  await run(
    'enrolments',
    csv(
      ['student_number', 'class_code'],
      students.flatMap(([studentNumber, , , , grade]) =>
        SUBJECTS.map((subject) => [
          studentNumber,
          `${subject.code}${grade.split(' ')[1]}A`,
        ]),
      ),
    ),
  );
  // Each subject meets once a day, at a different period for each grade.
  await run(
    'timetable',
    csv(
      ['class_code', 'day', 'period', 'room'],
      [6, 7, 8].flatMap((grade) =>
        SUBJECTS.flatMap((subject, index) =>
          [1, 2, 3, 4, 5].map((day) => [
            `${subject.code}${grade}A`,
            day,
            PERIODS[(index + day + grade) % PERIODS.length][0],
            `${grade}0${index + 1}`,
          ]),
        ),
      ),
    ),
  );
  await run(
    'standards',
    csv(
      [
        'framework_code',
        'framework_name',
        'code',
        'description',
        'parent_code',
      ],
      [
        [
          'SOCLE-C4',
          'Socle commun — cycle 4',
          'D1',
          'Les langages pour penser et communiquer',
          '',
        ],
        [
          'SOCLE-C4',
          '',
          'D1.1',
          'Comprendre, s’exprimer en utilisant la langue française à l’oral et à l’écrit',
          'D1',
        ],
        [
          'SOCLE-C4',
          '',
          'D1.3',
          'Comprendre, s’exprimer en utilisant les langages mathématiques, scientifiques et informatiques',
          'D1',
        ],
        ['SOCLE-C4', '', 'D2', 'Les méthodes et outils pour apprendre', ''],
        [
          'SOCLE-C4',
          '',
          'D4',
          'Les systèmes naturels et les systèmes techniques',
          '',
        ],
      ],
    ),
  );
  return { schoolId, created: !existing };
}
