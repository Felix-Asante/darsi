import type { INestApplication } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { v7 as uuidv7 } from 'uuid';
import { TenantTransactions } from '../src/common/tenancy/tenant-transactions.js';
import { Notification } from '../src/modules/notifications/notification.entity.js';
import { NotificationsService } from '../src/modules/notifications/notifications.service.js';
import { School } from '../src/modules/schools/school.entity.js';
import { createTestApp } from './support/create-test-app.js';
import { addMember, createSchool } from './support/identity.js';
import { expectTenantIsolation } from './support/tenant-isolation.js';

describe('Notifications (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const notify = (
    schoolId: string,
    userIds: string[],
    type = 'grade.published',
  ) =>
    app.get(TenantTransactions).runInSchool(schoolId, () =>
      app.get(NotificationsService).notify({
        userIds,
        type,
        params: { assessment: 'Fractions quiz' },
        link: '/grades',
      }),
    );

  it('shows each user only their own notices, newest first, and counts the unread ones', async () => {
    const school = await createSchool(app);
    const teacher = await addMember(app, school, ['teacher']);
    const guardian = await addMember(app, school, ['guardian']);

    await notify(school.id, [teacher.userId], 'assessment.submitted');
    await notify(
      school.id,
      [teacher.userId, guardian.userId],
      'grade.published',
    );

    const { body: inbox } = await teacher.session
      .get('/api/v1/notifications')
      .expect(200);
    expect(inbox.items.map((item: Notification) => item.type)).toEqual([
      'grade.published',
      'assessment.submitted',
    ]);
    expect(inbox.items[0]).toMatchObject({
      params: { assessment: 'Fractions quiz' },
      link: '/grades',
      readAt: null,
    });

    const { body: guardianInbox } = await guardian.session
      .get('/api/v1/notifications')
      .expect(200);
    expect(guardianInbox.items).toHaveLength(1);

    await teacher.session
      .get('/api/v1/notifications/unread-count')
      .expect(200, { count: 2 });
  });

  it('pages through the inbox with a cursor', async () => {
    const school = await createSchool(app);
    const teacher = await addMember(app, school, ['teacher']);
    for (let index = 0; index < 3; index += 1)
      await notify(school.id, [teacher.userId]);

    const { body: first } = await teacher.session
      .get('/api/v1/notifications?limit=2')
      .expect(200);
    const { body: second } = await teacher.session
      .get(`/api/v1/notifications?limit=2&cursor=${first.nextCursor}`)
      .expect(200);

    expect(first.items).toHaveLength(2);
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
  });

  it('marks notices read, and never someone else’s', async () => {
    const school = await createSchool(app);
    const teacher = await addMember(app, school, ['teacher']);
    const guardian = await addMember(app, school, ['guardian']);
    await notify(school.id, [teacher.userId, guardian.userId]);
    const { body: guardianInbox } = await guardian.session
      .get('/api/v1/notifications')
      .expect(200);

    await teacher.session
      .post('/api/v1/notifications/read')
      .send({ ids: [guardianInbox.items[0].id] })
      .expect(204);
    await guardian.session
      .get('/api/v1/notifications/unread-count')
      .expect(200, { count: 1 });

    await guardian.session.post('/api/v1/notifications/read-all').expect(204);
    await guardian.session
      .get('/api/v1/notifications/unread-count')
      .expect(200, { count: 0 });
  });

  it('isolates notices and school settings per school', async () => {
    const txHost =
      app.get<TransactionHost<TransactionalAdapterTypeOrm>>(TransactionHost);
    const school = await createSchool(app);

    await expectTenantIsolation(app, {
      table: 'notifications',
      insertRow: async () => {
        const id = uuidv7();
        const [{ id: userId }] = await txHost.tx.query<{ id: string }[]>(
          `SELECT id FROM users LIMIT 1`,
        );
        await txHost.tx.insert(Notification, {
          id,
          userId,
          type: 'probe',
          params: {},
        });
        return id;
      },
    });

    await app.get(TenantTransactions).runInSchool(uuidv7(), async () => {
      expect(
        await txHost.tx.findOneBy(School, { schoolId: school.id }),
      ).toBeNull();
    });
  });
});
