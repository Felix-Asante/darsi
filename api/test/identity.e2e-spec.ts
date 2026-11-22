import type { INestApplication } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { DataSource } from 'typeorm';
import { TenantTransactions } from '../src/common/tenancy/tenant-transactions.js';
import { AuditEvent } from '../src/modules/audit/audit-event.entity.js';
import { createTestApp } from './support/create-test-app.js';
import {
  addMember,
  agent,
  createSchool,
  deliverMail,
  mailbox,
  passwordToken,
  signIn,
  uniqueEmail,
  uniqueSlug,
} from './support/identity.js';
import { SchoolsService } from '../src/modules/schools/schools.service.js';

describe('Identity and school setup (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => mailbox(app).clear());

  const auditEvents = (schoolId: string, action: string) =>
    app.get(TenantTransactions).runInSchool(schoolId, () =>
      app
        .get<TransactionHost<TransactionalAdapterTypeOrm>>(TransactionHost)
        .tx.find(AuditEvent, {
          where: { action },
          order: { createdAt: 'DESC' },
        }),
    );

  describe('creating a school', () => {
    it('sends the first admin an account-setup link in the school language', async () => {
      const adminEmail = uniqueEmail('directrice');
      await app.get(SchoolsService).create({
        name: 'École du Lac',
        slug: uniqueSlug('ecole-du-lac'),
        adminName: 'Claire Martin',
        adminEmail,
        defaultLocale: 'fr',
        timeZone: 'Europe/Paris',
        currency: 'EUR',
      });

      await deliverMail(app);
      const mail = mailbox(app).assertSent({ to: adminEmail });
      expect(mail.subject).toBe('Votre compte Darsi pour École du Lac');
      expect(mail.html?.replace(/\s+/g, ' ')).toContain(
        'Choisissez un mot de passe',
      );
      expect(
        decodeURIComponent(mail.link('/api/auth/reset-password/').search),
      ).toContain('http://localhost:3000/fr/reset-password');
    });

    it('lets the admin choose a password, sign in and see the school', async () => {
      const school = await createSchool(app, {
        name: 'Greenfield School',
        currency: 'GBP',
        timeZone: 'Europe/London',
      });

      const { body } = await school.admin.get('/api/v1/me').expect(200);

      expect(body.schools).toEqual([
        expect.objectContaining({
          id: school.id,
          slug: school.slug,
          name: 'Greenfield School',
          roles: ['admin'],
        }),
      ]);
      expect(body.currentSchool).toMatchObject({
        id: school.id,
        currency: 'GBP',
        timeZone: 'Europe/London',
        onboardingCompleted: false,
        roles: ['admin'],
      });
    });

    it('refuses a subdomain that is already taken', async () => {
      const school = await createSchool(app);

      await expect(
        app.get(SchoolsService).create({
          name: 'Copycat',
          slug: school.slug,
          adminName: 'Someone',
          adminEmail: uniqueEmail('copycat'),
          defaultLocale: 'en',
          timeZone: 'UTC',
          currency: 'EUR',
        }),
      ).rejects.toMatchObject({ response: { code: 'slug_taken' } });
    });
  });

  describe('onboarding and settings', () => {
    it('completes onboarding and records it in the audit log', async () => {
      const school = await createSchool(app);

      const { body } = await school.admin
        .post('/api/v1/schools/current/onboarding')
        .send({
          name: 'Greenfield International',
          defaultLocale: 'fr',
          timeZone: 'Africa/Casablanca',
          currency: 'MAD',
        })
        .expect(201);

      expect(body).toMatchObject({
        name: 'Greenfield International',
        defaultLocale: 'fr',
        timeZone: 'Africa/Casablanca',
        currency: 'MAD',
        onboardingCompleted: true,
      });

      const [event] = await auditEvents(school.id, 'school.onboarded');
      expect(event.diff).toMatchObject({
        name: {
          before: 'Greenfield School',
          after: 'Greenfield International',
        },
        currency: { before: 'EUR', after: 'MAD' },
      });
    });

    it('rejects an unknown time zone or currency with field errors', async () => {
      const school = await createSchool(app);

      const { body } = await school.admin
        .patch('/api/v1/schools/current')
        .send({ timeZone: 'Mars/Olympus', currency: 'XXXX' })
        .expect(400);

      expect(body.code).toBe('validation_failed');
      expect(body.errors).toEqual([
        { field: 'timeZone', codes: ['isTimeZone'] },
        { field: 'currency', codes: ['isCurrencyCode'] },
      ]);
    });
  });

  describe('access', () => {
    it('requires a session', async () => {
      const { body } = await agent(app).get('/api/v1/me').expect(401);
      expect(body.code).toBe('unauthenticated');
    });

    it('keeps a member out of a school they do not belong to', async () => {
      const mine = await createSchool(app);
      const theirs = await createSchool(app);

      const { body } = await mine.admin
        .get('/api/v1/schools/current')
        .set('X-School-Slug', theirs.slug)
        .expect(403);
      expect(body.code).toBe('not_a_member');
    });

    it('records every sign-in', async () => {
      const school = await createSchool(app);
      await signIn(app, school.adminEmail);

      const [{ count }] = await app
        .get(DataSource)
        .query(
          `SELECT count(*)::int AS count FROM sign_in_events e JOIN users u ON u.id = e.user_id WHERE u.email = $1`,
          [school.adminEmail],
        );
      expect(count).toBeGreaterThanOrEqual(2);
    });
  });

  describe('members and roles', () => {
    it('invites a teacher by email, who signs up, verifies and joins with that role', async () => {
      const school = await createSchool(app);
      const teacherEmail = uniqueEmail('teacher');

      const teacher = await addMember(app, school, ['teacher'], teacherEmail);

      const invitation = mailbox(app).assertSent({
        to: teacherEmail,
        subject: 'Join Greenfield School on Darsi',
      });
      expect(invitation.html).toContain('as a teacher');
      const { body } = await teacher.session.get('/api/v1/me').expect(200);
      expect(body.currentSchool.roles).toEqual(['teacher']);
    });

    it('denies a teacher what only admins may do', async () => {
      const school = await createSchool(app);
      const teacher = await addMember(app, school, ['teacher']);

      await teacher.session
        .patch('/api/v1/schools/current')
        .send({ name: 'Hijacked' })
        .expect(403);
    });

    it('applies a role change on the next request and audits it', async () => {
      const school = await createSchool(app);
      const teacher = await addMember(app, school, ['teacher']);
      const { body: members } = await school.admin
        .get('/api/auth/organization/list-members')
        .query({ organizationId: school.id })
        .expect(200);
      const member = members.members.find(
        (candidate: { userId: string }) => candidate.userId === teacher.userId,
      );

      await school.admin
        .post('/api/auth/organization/update-member-role')
        .send({
          memberId: member.id,
          role: ['teacher', 'coordinator'],
          organizationId: school.id,
        })
        .expect(200);

      const { body } = await teacher.session.get('/api/v1/me').expect(200);
      expect(body.currentSchool.roles).toEqual(['teacher', 'coordinator']);
      const [event] = await auditEvents(school.id, 'member.role_changed');
      expect(event.diff).toEqual({
        roles: { before: 'teacher', after: 'teacher,coordinator' },
      });
    });

    it('refuses roles Darsi does not define', async () => {
      const school = await createSchool(app);

      await school.admin
        .post('/api/auth/organization/invite-member')
        .send({
          email: uniqueEmail('owner'),
          role: 'owner',
          organizationId: school.id,
        })
        .expect(400);
    });

    it('lets a member who forgot their password reset it', async () => {
      const school = await createSchool(app);
      await agent(app)
        .post('/api/auth/request-password-reset')
        .send({
          email: school.adminEmail,
          redirectTo: 'http://localhost:3000/reset-password',
        })
        .expect(200);

      const token = await passwordToken(app, school.adminEmail);
      const mail = mailbox(app).assertSent({ to: school.adminEmail });
      expect(mail.subject).toBe('Reset your Darsi password');

      await agent(app)
        .post('/api/auth/reset-password')
        .send({ token, newPassword: 'a-brand-new-password' })
        .expect(200);
      await signIn(app, school.adminEmail, 'a-brand-new-password');
    });
  });
});
