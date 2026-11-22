import type { INestApplicationContext } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { ClsService } from 'nestjs-cls';
import { DataSource } from 'typeorm';
import { RequestContext } from '../common/tenancy/request-context.js';
import { TenantTransactions } from '../common/tenancy/tenant-transactions.js';
import { AcademicsService } from '../modules/academics/academics.service.js';
import { AdmissionsSetupService } from '../modules/admissions/admissions-setup.service.js';
import { ApplicationsService } from '../modules/admissions/applications.service.js';
import { MembershipService } from '../modules/admissions/membership.service.js';
import { NOTIFICATION_TYPES } from '../modules/notifications/notification-preference.entity.js';
import { NotificationsService } from '../modules/notifications/notifications.service.js';
import { AnnouncementsService } from '../modules/announcements/announcements.service.js';
import { AssessmentsService } from '../modules/assessment/assessments.service.js';
import { GradingService } from '../modules/assessment/grading.service.js';
import { AttendanceService } from '../modules/attendance/attendance.service.js';
import type { Role } from '../modules/auth/access-control.js';
import { AUTH, type Auth } from '../modules/auth/auth.factory.js';
import { BillingSetupService } from '../modules/billing/billing-setup.service.js';
import { InvoicesService } from '../modules/billing/invoices.service.js';
import { PaymentsService } from '../modules/billing/payments.service.js';
import { CalendarService } from '../modules/calendar/calendar.service.js';
import type { ImportKind } from '../modules/imports/entities/import-job.entity.js';
import { ImportRows } from '../modules/imports/import-rows.js';
import { PlanningService } from '../modules/planning/planning.service.js';
import { PortfolioService } from '../modules/portfolio/portfolio.service.js';
import { SchoolClock } from '../modules/schools/school-clock.service.js';
import { TimetablesService } from '../modules/timetables/timetables.service.js';

const YEAR_GROUPS = [7, 8, 9, 10, 11];
const DIVISIONS = [
  { name: 'Key Stage 3', years: [7, 8, 9] },
  { name: 'Key Stage 4', years: [10, 11] },
];
const SUBJECTS = [
  { code: 'MATH', name: 'Mathematics' },
  { code: 'ENG', name: 'English' },
  { code: 'SCI', name: 'Science' },
  { code: 'HIST', name: 'History' },
  { code: 'GEOG', name: 'Geography' },
  { code: 'FREN', name: 'French' },
  { code: 'COMP', name: 'Computing' },
];
const PERIODS = [
  ['P1', '08:45', '09:45'],
  ['P2', '09:45', '10:45'],
  ['P3', '11:05', '12:05'],
  ['P4', '12:05', '13:05'],
  ['P5', '13:50', '14:50'],
  ['P6', '14:50', '15:50'],
];
const FIRST_NAMES = [
  'Oliver',
  'Amelia',
  'George',
  'Isla',
  'Arthur',
  'Ava',
  'Noah',
  'Mia',
  'Muhammad',
  'Ivy',
  'Leo',
  'Lily',
  'Harry',
  'Florence',
  'Oscar',
  'Freya',
  'Archie',
  'Grace',
  'Henry',
  'Sophia',
  'Theodore',
  'Evie',
  'Jack',
  'Poppy',
  'Freddie',
  'Ella',
  'Alfie',
  'Aisha',
  'Ethan',
  'Zara',
  'Samuel',
  'Chloe',
];
const FAMILIES = [
  ['Smith', 'Sarah'],
  ['Patel', 'Priya'],
  ['Jones', 'David'],
  ['Williams', 'Emma'],
  ['Brown', 'James'],
  ['Khan', 'Fatima'],
  ['Taylor', 'Rachel'],
  ['Davies', 'Mark'],
  ['Evans', 'Claire'],
  ['Wilson', 'Tom'],
  ['Thomas', 'Helen'],
  ['Okafor', 'Chidi'],
  ['Roberts', 'Laura'],
  ['Johnson', 'Paul'],
  ['Ahmed', 'Yasmin'],
  ['Walker', 'Kate'],
  ['Wright', 'Richard'],
  ['Robinson', 'Anna'],
  ['Thompson', 'Simon'],
  ['Nguyen', 'Linh'],
  ['White', 'Joanne'],
  ['Hughes', 'Gareth'],
  ['Edwards', 'Lucy'],
  ['Green', 'Daniel'],
  ['Hall', 'Victoria'],
  ['Wood', 'Andrew'],
  ['Mensah', 'Akosua'],
  ['Clarke', 'Nicola'],
  ['Lewis', 'Steven'],
  ['Kowalski', 'Agnieszka'],
];
const APPLICANTS = [
  ['Ruby', 'Fletcher', 'Jane'],
  ['Jacob', 'Osei', 'Kwame'],
  ['Maya', 'Singh', 'Anita'],
  ['Elliot', 'Baker', 'Sophie'],
  ['Hannah', 'Murphy', 'Sean'],
  ['Yusuf', 'Ali', 'Mariam'],
  ['Alice', 'Carter', 'Ben'],
  ['Ibrahim', 'Diallo', 'Awa'],
];

const doc = (...paragraphs: string[]) => ({
  type: 'doc',
  content: paragraphs.map((text) => ({
    type: 'paragraph',
    content: [{ type: 'text', text }],
  })),
});

const csv = (header: string[], rows: (string | number)[][]) =>
  rows.map((row) =>
    Object.fromEntries(
      header.map((column, index) => [column, String(row[index] ?? '')]),
    ),
  );

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

/** Weekdays from `from` to `to`, skipping the given closed ranges. */
function schoolDays(from: string, to: string, closed: [string, string][]) {
  const days: string[] = [];
  for (
    let day = new Date(`${from}T00:00:00Z`);
    isoDate(day) <= to;
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    const date = isoDate(day);
    const weekday = day.getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    if (closed.some(([start, end]) => date >= start && date <= end)) continue;
    days.push(date);
  }
  return days;
}

/** Deterministic pseudo-random numbers, so a run always produces the same school. */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function people() {
  const students: string[][] = [];
  const guardians: string[][] = [];
  let number = 1;
  FAMILIES.forEach(([lastName, guardian], family) => {
    const children = 1 + (family % 3 === 0 ? 2 : family % 2);
    const numbers: string[] = [];
    for (let child = 0; child < children; child += 1) {
      const year = YEAR_GROUPS[(family + child * 2) % YEAR_GROUPS.length];
      const studentNumber = `LA${String(number).padStart(4, '0')}`;
      const day = String(1 + ((number * 7) % 28)).padStart(2, '0');
      const month = 1 + ((number * 5) % 12);
      // Year 7 starting in September 2026 were born between September 2014 and August 2015.
      const born = 2026 - year - 4 - (month >= 9 ? 1 : 0);
      students.push([
        studentNumber,
        FIRST_NAMES[(family * 3 + child) % FIRST_NAMES.length],
        lastName,
        `${born}-${String(month).padStart(2, '0')}-${day}`,
        `Year ${year}`,
      ]);
      numbers.push(studentNumber);
      number += 1;
    }
    guardians.push([
      `${guardian.toLowerCase()}.${lastName.toLowerCase()}@families.example.com`,
      guardian,
      lastName,
      'en',
      numbers.join(';'),
      family % 3 === 0 ? 'father' : 'mother',
    ]);
  });
  return { students, guardians };
}

/**
 * Demo content for an existing English-language UK school: everything a demo
 * needs except staff accounts. The school admin is the actor, as if they had
 * entered it all through the app. Runs in one transaction, and refuses a school
 * that already has students.
 */
export async function seedUkDemo(
  app: INestApplicationContext,
  {
    slug,
    log = () => undefined,
  }: { slug: string; log?: (line: string) => void },
) {
  const dataSource = app.get(DataSource);
  const [school] = await dataSource.query<{ id: string; name: string }[]>(
    `SELECT id, name FROM organizations WHERE slug = $1`,
    [slug],
  );
  if (!school) throw new Error(`No school with slug "${slug}"`);
  const [admin] = await dataSource.query<{ user_id: string }[]>(
    `SELECT user_id FROM members WHERE organization_id = $1 AND role LIKE '%admin%' ORDER BY created_at LIMIT 1`,
    [school.id],
  );
  if (!admin) throw new Error(`${slug} has no admin`);

  const cls = app.get(ClsService);
  const context = app.get(RequestContext);
  const transactions = app.get(TenantTransactions);
  const academics = app.get(AcademicsService);
  const rows = app.get(ImportRows);

  const actAs = (userId: string, roles: Role[]) => {
    context.setSchool(school.id, roles);
    context.setUser(userId);
  };
  const txHost =
    app.get<TransactionHost<TransactionalAdapterTypeOrm>>(TransactionHost);
  const query = <T>(sql: string, params: unknown[] = []) =>
    txHost.tx.query<T>(sql, params);

  // Applicant families sign up on the public page; their accounts exist before the transaction.
  const auth = await app.get<Auth>(AUTH).$context;
  const applicantIds: string[] = [];
  for (const [, lastName, parent] of APPLICANTS) {
    const email = `${parent.toLowerCase()}.${lastName.toLowerCase()}@families.example.com`;
    const existing = await auth.internalAdapter.findUserByEmail(email);
    const user =
      existing?.user ??
      (await auth.internalAdapter.createUser(
        {
          email,
          name: `${parent} ${lastName}`,
          emailVerified: true,
          locale: 'en',
        },
        { method: 'admin' },
      ));
    applicantIds.push(user.id);
  }

  return cls.run(async () => {
    actAs(admin.user_id, ['admin']);
    return transactions.run(async () => {
      const [{ count }] = await query<{ count: string }[]>(
        `SELECT count(*) FROM students`,
      );
      if (Number(count) > 0)
        throw new Error(`${slug} already has students; not seeding twice`);

      // ── Academic structure ────────────────────────────────────────────
      const year = await academics.createYear({
        name: '2026–2027',
        startsOn: '2026-09-02',
        endsOn: '2027-07-21',
        isCurrent: true,
      });
      const autumn = await academics.createTerm(year.id, {
        name: 'Autumn term',
        startsOn: '2026-09-02',
        endsOn: '2026-12-18',
      });
      await academics.createTerm(year.id, {
        name: 'Spring term',
        startsOn: '2027-01-05',
        endsOn: '2027-03-26',
      });
      await academics.createTerm(year.id, {
        name: 'Summer term',
        startsOn: '2027-04-12',
        endsOn: '2027-07-21',
      });
      const nextYear = await academics.createYear({
        name: '2027–2028',
        startsOn: '2027-09-01',
        endsOn: '2028-07-20',
        isCurrent: false,
      });
      for (const [order, { name, years }] of DIVISIONS.entries()) {
        const division = await academics.createDivision({
          name,
          sortOrder: order,
        });
        for (const [sortOrder, yearGroup] of years.entries())
          await academics.createGradeLevel({
            divisionId: division.id,
            name: `Year ${yearGroup}`,
            sortOrder,
          });
      }
      for (const subject of SUBJECTS) await academics.createSubject(subject);
      log('  academic year, terms, key stages, subjects');

      const grading = app.get(GradingService);
      const gcse = await grading.createScale({
        name: 'GCSE grades (9–1)',
        preset: 'uk_gcse',
      });
      const percentage = await grading.createScale({
        name: 'Percentage',
        preset: 'percentage',
      });
      const policy = await grading.savePolicy({
        reportingScaleId: gcse.id,
        method: 'weighted_average',
        categories: [
          { name: 'Homework', weight: 30 },
          { name: 'Assessments', weight: 70 },
        ],
      });
      const homework = policy.categories.find((c) => c.name === 'Homework')!;
      const tests = policy.categories.find((c) => c.name === 'Assessments')!;

      const timetables = app.get(TimetablesService);
      const schedule = await timetables.createSchedule({
        name: 'Bell schedule',
        rotationKind: 'weekly',
        rotationLength: 1,
      });
      for (const [name, startsAt, endsAt] of PERIODS)
        await timetables.createPeriod(schedule.id, { name, startsAt, endsAt });
      log('  grading scales and policy, bell schedule');

      // ── People and classes (through the CSV import rules) ─────────────
      const run = async (
        kind: ImportKind,
        records: Record<string, string>[],
      ) => {
        for (const record of records) await rows.handle(kind, record);
        log(`  ${kind}: ${records.length}`);
      };
      const { students, guardians } = people();
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
      const classCode = (subject: string, yearGroup: number) =>
        `${yearGroup}${subject}`;
      await run(
        'classes',
        csv(
          ['code', 'name', 'subject_code', 'grade_level', 'teacher_emails'],
          YEAR_GROUPS.flatMap((yearGroup) =>
            SUBJECTS.map((subject) => [
              classCode(subject.code, yearGroup),
              `Year ${yearGroup} ${subject.name}`,
              subject.code,
              `Year ${yearGroup}`,
              '',
            ]),
          ),
        ),
      );
      await run(
        'enrolments',
        csv(
          ['student_number', 'class_code'],
          students.flatMap(([studentNumber, , , , yearGroup]) =>
            SUBJECTS.map((subject) => [
              studentNumber,
              classCode(subject.code, Number(yearGroup.split(' ')[1])),
            ]),
          ),
        ),
      );
      await run(
        'timetable',
        csv(
          ['class_code', 'day', 'period', 'room'],
          YEAR_GROUPS.flatMap((yearGroup) =>
            SUBJECTS.flatMap((subject, index) =>
              [1, 2, 3, 4, 5]
                .filter((day) => (index + day) % 7 !== 0)
                .map((day) => [
                  classCode(subject.code, yearGroup),
                  day,
                  PERIODS[(index + day + yearGroup) % PERIODS.length][0],
                  `${['M', 'E', 'S', 'H', 'G', 'L', 'C'][index]}${yearGroup}`,
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
              'NC-KS3-MA',
              'National Curriculum — KS3 Mathematics',
              'NUM',
              'Number',
              '',
            ],
            [
              'NC-KS3-MA',
              '',
              'NUM.1',
              'Use the four operations with integers, decimals and fractions',
              'NUM',
            ],
            ['NC-KS3-MA', '', 'ALG', 'Algebra', ''],
            [
              'NC-KS3-MA',
              '',
              'ALG.1',
              'Use and interpret algebraic notation',
              'ALG',
            ],
            ['NC-KS3-MA', '', 'GEO', 'Geometry and measures', ''],
            [
              'NC-KS3-MA',
              '',
              'GEO.1',
              'Derive and apply formulae for perimeter, area and volume',
              'GEO',
            ],
          ],
        ),
      );

      const classes = await query<
        { id: string; code: string; grade_level_id: string }[]
      >(`SELECT id, code, grade_level_id FROM classes`);
      const roster = await query<
        { id: string; class_id: string; family_id: string | null }[]
      >(
        `SELECT s.id, e.class_id, s.family_id FROM enrolments e JOIN students s ON s.id = e.student_id`,
      );
      const studentsIn = (classId: string) =>
        roster.filter((row) => row.class_id === classId).map((row) => row.id);
      const classOf = (code: string) => classes.find((c) => c.code === code)!;

      // ── Calendar ──────────────────────────────────────────────────────
      const calendar = app.get(CalendarService);
      const events: [string, 'holiday' | 'exam' | 'event', string, string?][] =
        [
          ['October half term', 'holiday', '2026-10-26', '2026-10-30'],
          ['Christmas holidays', 'holiday', '2026-12-21', '2027-01-04'],
          ['February half term', 'holiday', '2027-02-15', '2027-02-19'],
          ['Easter holidays', 'holiday', '2027-03-29', '2027-04-09'],
          ['May half term', 'holiday', '2027-05-31', '2027-06-04'],
          ['Year 11 mock exams', 'exam', '2026-12-07', '2026-12-11'],
          ['Year 7 parents’ evening', 'event', '2026-11-26'],
          ['Christmas concert', 'event', '2026-12-16'],
          ['Inset day', 'holiday', '2027-01-04'],
          ['Sports day', 'event', '2027-07-09'],
        ];
      for (const [title, kind, startsOn, endsOn] of events)
        await calendar.createEvent({
          title,
          kind,
          startsOn,
          endsOn: endsOn ?? startsOn,
          audience: 'school',
        });
      log(`  calendar events: ${events.length}`);

      // ── Assessments and grades ────────────────────────────────────────
      // Grades are entered and published by a class's teacher. With no staff
      // yet, the admin stands in as every class's teacher for this step only.
      const assessments = app.get(AssessmentsService);
      await query(
        `INSERT INTO class_staff (id, class_id, user_id, role) SELECT gen_random_uuid(), id, $1, 'teacher' FROM classes`,
        [admin.user_id],
      );
      actAs(admin.user_id, ['admin', 'teacher']);
      const rand = random(42);
      const gcseGrade = (ability: number) =>
        String(
          Math.max(
            1,
            Math.min(9, Math.round(ability * 8 + 1 + (rand() - 0.5) * 2)),
          ),
        );
      const ability = new Map(
        roster.map((row) => [row.id, 0.25 + rand() * 0.7]),
      );
      const plan = [
        {
          title: 'Baseline assessment',
          kind: 'summative',
          scale: gcse,
          category: tests,
          dueOn: '2026-09-25',
        },
        {
          title: 'Homework: half-term project',
          kind: 'formative',
          scale: percentage,
          category: homework,
          dueOn: '2026-10-23',
        },
        {
          title: 'Autumn unit test',
          kind: 'summative',
          scale: gcse,
          category: tests,
          dueOn: '2026-11-13',
        },
      ] as const;
      let gradeCount = 0;
      for (const schoolClass of classes) {
        const classStudents = studentsIn(schoolClass.id);
        for (const item of plan) {
          const assessment = await assessments.create(schoolClass.id, {
            title: item.title,
            kind: item.kind,
            dueOn: item.dueOn,
            scaleId: item.scale.id,
            categoryId: item.category.id,
          });
          await assessments.saveGrades(assessment.id, {
            grades: classStudents.map((studentId) => {
              const level = ability.get(studentId)!;
              return {
                studentId,
                value:
                  item.scale.id === gcse.id
                    ? gcseGrade(level)
                    : String(
                        Math.min(
                          100,
                          Math.round(level * 70 + 25 + rand() * 10),
                        ),
                      ),
              };
            }),
            publish: true,
          });
          gradeCount += classStudents.length;
        }
      }
      actAs(admin.user_id, ['admin']);
      await query(`DELETE FROM class_staff WHERE user_id = $1`, [
        admin.user_id,
      ]);
      // An upcoming assessment, not marked yet, in every Year 11 class.
      for (const subject of SUBJECTS)
        await assessments.create(classOf(classCode(subject.code, 11)).id, {
          title: 'Mock exam paper 1',
          kind: 'summative',
          dueOn: '2026-12-09',
          scaleId: gcse.id,
          categoryId: tests.id,
        });
      log(
        `  assessments: ${classes.length * plan.length + SUBJECTS.length}, grades: ${gradeCount}`,
      );

      // ── Attendance (daily register, taken in each year's maths class) ─
      const attendance = app.get(AttendanceService);
      const statuses = (await attendance.statuses()).map(
        (status) => status.code,
      );
      const pick = (code: string) =>
        statuses.includes(code) ? code : 'present';
      const today = await app.get(SchoolClock).today();
      const days = schoolDays(
        autumn.startsOn,
        today < autumn.endsOn ? today : autumn.endsOn,
        [['2026-10-26', '2026-10-30']],
      ).slice(-20);
      let registers = 0;
      for (const yearGroup of YEAR_GROUPS) {
        const schoolClass = classOf(classCode('MATH', yearGroup));
        for (const date of days) {
          await attendance.take(schoolClass.id, {
            date,
            records: studentsIn(schoolClass.id).map((studentId) => {
              const roll = rand();
              return roll < 0.04
                ? { studentId, status: pick('absent') }
                : roll < 0.07
                  ? { studentId, status: pick('late') }
                  : roll < 0.08
                    ? {
                        studentId,
                        status: pick('excused'),
                        reason: 'Medical appointment',
                      }
                    : { studentId, status: 'present' };
            }),
          });
          registers += 1;
        }
      }
      log(`  attendance registers: ${registers}`);

      // ── Announcements ─────────────────────────────────────────────────
      const announcements = app.get(AnnouncementsService);
      const posts = [
        {
          title: 'Welcome back to the autumn term',
          body: doc(
            'Welcome back, everyone. We hope you had a restful summer.',
            'Please check the calendar for this term’s key dates, including October half term and the Christmas concert.',
          ),
        },
        {
          title: 'Year 7 parents’ evening on 26 November',
          body: doc(
            'Year 7 parents’ evening takes place on Thursday 26 November from 4pm to 7pm in the main hall.',
            'Appointments can be booked with each subject teacher through the school office.',
          ),
        },
        {
          title: 'Christmas concert tickets',
          body: doc(
            'Our Christmas concert is on Wednesday 16 December at 6pm.',
            'Tickets are free but limited to two per family. Please reply to this announcement to reserve yours.',
          ),
        },
      ];
      for (const post of posts)
        await announcements.create({ ...post, audience: 'school' });
      log(`  announcements: ${posts.length}`);

      // ── Planning ──────────────────────────────────────────────────────
      const planning = app.get(PlanningService);
      const [standard] = await query<{ id: string }[]>(
        `SELECT id FROM standards WHERE code = 'NUM.1'`,
      );
      const units = [
        {
          subject: 'MATH',
          title: 'Fractions, decimals and percentages',
          standardIds: [standard.id],
        },
        { subject: 'ENG', title: 'Gothic fiction: reading and writing' },
        { subject: 'SCI', title: 'Cells and organisation' },
        { subject: 'HIST', title: 'The Norman Conquest' },
        { subject: 'GEOG', title: 'Rivers and flooding' },
      ];
      for (const unit of units)
        await planning.create({
          title: unit.title,
          startsOn: '2026-11-02',
          endsOn: '2026-12-18',
          objectives: doc(
            `Students build a secure understanding of ${unit.title.toLowerCase()}.`,
          ),
          classIds: [classOf(classCode(unit.subject, 7)).id],
          standardIds: unit.standardIds ?? [],
        });
      log(`  unit plans: ${units.length}`);

      // ── Portfolio ─────────────────────────────────────────────────────
      const portfolio = app.get(PortfolioService);
      await portfolio.saveSettings(false);
      const year9English = classOf(classCode('ENG', 9));
      const essays = studentsIn(year9English.id).slice(0, 6);
      for (const studentId of essays)
        await portfolio.add({
          studentId,
          classId: year9English.id,
          kind: 'text',
          title: 'Persuasive letter to the council',
          body: doc(
            'Dear Councillors, I am writing to ask you to keep our local library open.',
            'Libraries give everyone a quiet place to study, free books and internet access.',
          ),
          tags: ['writing', 'persuasion'],
        });
      log(`  portfolio items: ${essays.length}`);

      // ── Fees ──────────────────────────────────────────────────────────
      const billingSetup = app.get(BillingSetupService);
      await billingSetup.saveSettings({
        rounding: 'half_up',
        invoicePrefix: 'LA-',
        paymentTermsDays: 30,
        reminderDaysBefore: [7],
        reminderDaysAfter: [7, 21],
      });
      const tuition = await billingSetup.saveFeeItem({
        name: 'Tuition',
        kind: 'tuition',
        amount: '0',
        taxRateBp: 0,
      });
      const meals = await billingSetup.saveFeeItem({
        name: 'School meals',
        kind: 'other',
        amount: '0',
        taxRateBp: 0,
      });
      const trip = await billingSetup.saveFeeItem({
        name: 'Educational trips',
        kind: 'trip',
        amount: '0',
        taxRateBp: 0,
      });
      const gradeLevels = await query<{ id: string; name: string }[]>(
        `SELECT id, name FROM grade_levels`,
      );
      for (const level of gradeLevels) {
        const keyStage4 = level.name === 'Year 10' || level.name === 'Year 11';
        await billingSetup.saveStructure({
          academicYearId: year.id,
          gradeLevelId: level.id,
          name: `${level.name} fees`,
          schedule: 'term',
          lines: [
            { feeItemId: tuition.id, amount: keyStage4 ? '685000' : '640000' },
            { feeItemId: meals.id, amount: '42000' },
            { feeItemId: trip.id, amount: '7500' },
          ],
        });
      }
      const invoices = app.get(InvoicesService);
      await invoices.run({
        academicYearId: year.id,
        schedule: 'term',
        termId: autumn.id,
        dueDate: '2026-10-01',
      });
      const issued = await query<
        { id: string; family_id: string; total: string }[]
      >(
        `SELECT id, family_id, total FROM invoices WHERE status <> 'draft' ORDER BY number`,
      );
      const payments = app.get(PaymentsService);
      let paid = 0;
      for (const [index, invoice] of issued.entries()) {
        const share = index % 5;
        if (share === 4) continue; // Overdue, unpaid.
        const amount =
          share === 3
            ? String(Math.floor(Number(invoice.total) / 2))
            : invoice.total;
        await payments.record({
          familyId: invoice.family_id,
          amount,
          method: index % 2 === 0 ? 'transfer' : 'cheque',
          reference: `BACS-${String(1000 + index)}`,
          receivedOn: `2026-09-${String(10 + (index % 18)).padStart(2, '0')}`,
          invoiceId: invoice.id,
        });
        paid += 1;
      }
      log(
        `  fee items, termly structures, ${issued.length} autumn invoices, ${paid} payments`,
      );

      // ── Admissions for September 2027 ─────────────────────────────────
      const admissions = app.get(AdmissionsSetupService);
      const year7 = gradeLevels.find((level) => level.name === 'Year 7')!;
      const year9 = gradeLevels.find((level) => level.name === 'Year 9')!;
      await admissions.saveForm({
        fields: [
          {
            key: 'current_school',
            label: { en: 'Current school' },
            type: 'text',
            required: true,
          },
          {
            key: 'siblings',
            label: { en: 'Siblings at London Academy' },
            type: 'text',
            required: false,
          },
          {
            key: 'heard_from',
            label: { en: 'How did you hear about us?' },
            type: 'select',
            required: false,
            options: ['Open day', 'Friend or family', 'Online', 'Other'],
          },
          {
            key: 'send',
            label: { en: 'Special educational needs or disabilities' },
            type: 'textarea',
            required: false,
          },
        ],
        documents: [],
      });
      const cycle = await admissions.saveCycle({
        academicYearId: nextYear.id,
        name: 'September 2027 entry',
        opensOn: '2026-09-15',
        closesOn: '2027-01-31',
        grades: [
          { gradeLevelId: year7.id, places: 60 },
          { gradeLevelId: year9.id, places: 5 },
        ],
        applicationFee: '0',
      });
      const stages = await admissions.stages();
      const applications = app.get(ApplicationsService);
      const membership = app.get(MembershipService);
      const notifications = app.get(NotificationsService);
      const created: string[] = [];
      for (const [index, [first, last, parent]] of APPLICANTS.entries()) {
        const userId = applicantIds[index];
        await membership.join(school.id, userId);
        actAs(userId, ['applicant']);
        // Demo addresses do not exist: keep these families in-app only so nothing bounces.
        for (const type of NOTIFICATION_TYPES)
          await notifications.savePreference(type, true, false);
        const application = await applications.create({
          cycleId: cycle.id,
          gradeLevelId: index === 7 ? year9.id : year7.id,
          studentFirstName: first,
          studentLastName: last,
          studentDateOfBirth: `2016-0${1 + (index % 8)}-1${index}`,
          guardianFirstName: parent,
          guardianLastName: last,
          guardianPhone: `07700 900${String(100 + index)}`,
          guardianRelationship: index % 2 === 0 ? 'mother' : 'father',
          answers: {
            current_school: [
              'St Mary’s Primary',
              'Highgate Primary',
              'Oakwood Primary',
              'Riverside Primary',
            ][index % 4],
            heard_from: ['Open day', 'Friend or family', 'Online'][index % 3],
          },
        });
        if (index < 6) await applications.submit(application.id);
        created.push(application.id);
        actAs(admin.user_id, ['admin']);
      }
      const stage = (kind: string) => stages.find((s) => s.kind === kind)!;
      await applications.move(created[1], stage('review').id);
      await applications.move(created[2], stage('review').id);
      await applications.move(created[3], stage('interview').id);
      await applications.move(created[4], stage('interview').id);
      await applications.addNote(created[3], {
        kind: 'interview',
        body: 'Lovely interview. Strong in maths and keen to join the robotics club.',
      });
      log(
        `  admissions cycle and ${APPLICANTS.length} applications (2 drafts)`,
      );

      await query(
        `UPDATE schools SET onboarding_completed_at = now() WHERE onboarding_completed_at IS NULL`,
      );
      return { students: students.length, families: guardians.length };
    });
  });
}
