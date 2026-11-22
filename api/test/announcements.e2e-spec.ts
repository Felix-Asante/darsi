import { getQueueToken } from '@nestjs/bullmq';
import type { INestApplication } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { v7 as uuidv7 } from 'uuid';
import {
  addDays,
  todayIn,
  zonedTimeToUtc,
} from '../src/common/dates/calendar-date.js';
import {
  ANNOUNCEMENTS_QUEUE,
  AnnouncementsService,
} from '../src/modules/announcements/announcements.service.js';
import { createTestApp } from './support/create-test-app.js';
import {
  addMember,
  createSchool,
  deliverMail,
  mailbox,
  uniqueEmail,
} from './support/identity.js';

const body = (text: string) => ({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text,
          marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
        },
      ],
    },
  ],
});

describe('Announcements (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function setUp() {
    const school = await createSchool(app);
    const post = async (path: string, payload: object) =>
      (await school.admin.post(`/api/v1${path}`).send(payload).expect(201))
        .body;
    const year = await post('/academics/years', {
      name: 'Year',
      startsOn: '2026-09-01',
      endsOn: '2027-07-02',
    });
    const myClass = await post('/academics/classes', {
      academicYearId: year.id,
      code: '7A',
      name: 'Class 7A',
    });
    const otherClass = await post('/academics/classes', {
      academicYearId: year.id,
      code: '7B',
      name: 'Class 7B',
    });
    const teacher = await addMember(app, school, ['teacher']);
    const assistant = await addMember(app, school, ['teaching_assistant']);
    const outsider = await addMember(app, school, ['teacher']);
    await school.admin
      .put(`/api/v1/academics/classes/${myClass.id}/staff`)
      .send({
        staff: [
          { userId: teacher.userId, role: 'teacher' },
          { userId: assistant.userId, role: 'teaching_assistant' },
        ],
      })
      .expect(200);

    const student = await post('/students', {
      studentNumber: `S-${uuidv7().slice(-6)}`,
      firstName: 'Amira',
      lastName: 'Haddad',
    });
    await post(`/academics/classes/${myClass.id}/students`, {
      studentIds: [student.id],
    });
    const parentEmail = uniqueEmail('parent');
    const guardian = await post('/guardians', {
      firstName: 'Leila',
      lastName: 'Haddad',
      email: parentEmail,
      preferredLocale: 'fr',
    });
    await post(`/students/${student.id}/guardians`, {
      guardianId: guardian.id,
      relationship: 'mother',
    });
    const parent = await addMember(app, school, ['guardian'], parentEmail);
    await deliverMail(app);
    return {
      school,
      myClass,
      otherClass,
      teacher,
      assistant,
      outsider,
      parent,
      parentEmail,
    };
  }

  it('lets a teacher post to their class; families get it in-app and by email, others never see it', async () => {
    const { myClass, otherClass, teacher, outsider, parent, parentEmail } =
      await setUp();
    await teacher.session
      .post('/api/v1/announcements')
      .send({
        title: 'Trip on Friday',
        body: body('Bring lunch'),
        audience: 'class',
        audienceId: otherClass.id,
      })
      .expect(403);
    await teacher.session
      .post('/api/v1/announcements')
      .send({ title: 'Everyone', body: body('x'), audience: 'school' })
      .expect(403);
    const { body: created } = await teacher.session
      .post('/api/v1/announcements')
      .send({
        title: 'Trip on Friday',
        body: body('Bring lunch'),
        audience: 'class',
        audienceId: myClass.id,
      })
      .expect(201);
    expect(created).toMatchObject({
      audienceName: 'Class 7A',
      publishedAt: expect.any(String),
    });
    expect(created.body.content[0].content[0]).toEqual({
      type: 'text',
      text: 'Bring lunch',
    });

    const { body: feed } = await parent.session
      .get('/api/v1/announcements')
      .expect(200);
    expect(feed.items.map((item: { title: string }) => item.title)).toEqual([
      'Trip on Friday',
    ]);
    const { body: elsewhere } = await outsider.session
      .get('/api/v1/announcements')
      .expect(200);
    expect(elsewhere.items).toEqual([]);

    await deliverMail(app);
    const [mail] = mailbox(app)
      .filter({ to: parentEmail })
      .filter((sent) => sent.template === 'notice');
    expect(mail.subject).toBe('Trip on Friday');
    expect(mail.html?.replace(/\s+/g, ' ')).toContain('Bring lunch');
    expect(mail.html).toContain('/fr/announcements');
  });

  it('lets assistants post only when the teacher allows it', async () => {
    const { myClass, teacher, assistant } = await setUp();
    const send = () =>
      assistant.session.post('/api/v1/announcements').send({
        title: 'Reminder',
        body: body('Homework'),
        audience: 'class',
        audienceId: myClass.id,
      });
    await send().expect(403);
    await assistant.session
      .put(`/api/v1/announcements/classes/${myClass.id}/settings`)
      .send({ assistantsCanPost: true })
      .expect(403);
    await teacher.session
      .put(`/api/v1/announcements/classes/${myClass.id}/settings`)
      .send({ assistantsCanPost: true })
      .expect(200);
    await send().expect(201);
  });

  it('schedules an announcement for a time in the school’s time zone and sends it then (ANN-4)', async () => {
    const { school, parent } = await setUp();
    const tomorrow = addDays(todayIn('Europe/Paris'), 1);
    const { body: scheduled } = await school.admin
      .post('/api/v1/announcements')
      .send({
        title: 'Assembly',
        body: body('Hall at 9'),
        audience: 'role',
        audienceRole: 'guardian',
        publishAt: `${tomorrow}T08:30`,
      })
      .expect(201);
    const due = zonedTimeToUtc(`${tomorrow}T08:30`, 'Europe/Paris');
    expect(new Date(scheduled.publishAt).toISOString()).toBe(due.toISOString());
    expect(scheduled.publishedAt).toBeNull();

    const job = await app
      .get<Queue>(getQueueToken(ANNOUNCEMENTS_QUEUE))
      .getJob(`announcement-${scheduled.id}`);
    expect(
      Math.abs(job!.timestamp + job!.opts.delay! - due.getTime()),
    ).toBeLessThan(5000);

    const { body: before } = await parent.session
      .get('/api/v1/announcements')
      .expect(200);
    expect(before.items).toEqual([]);
    const service = app.get(AnnouncementsService);
    expect(
      await service.publishScheduled({
        schoolId: school.id,
        announcementId: scheduled.id,
      }),
    ).toBe(false);
    expect(
      await service.publishScheduled(
        { schoolId: school.id, announcementId: scheduled.id },
        due,
      ),
    ).toBe(true);
    const { body: after } = await parent.session
      .get('/api/v1/announcements')
      .expect(200);
    expect(after.items.map((item: { title: string }) => item.title)).toEqual([
      'Assembly',
    ]);

    await school.admin
      .post('/api/v1/announcements')
      .send({
        title: 'Past',
        body: body('x'),
        audience: 'school',
        publishAt: '2020-01-01T08:00',
      })
      .expect(400);
  });
});
