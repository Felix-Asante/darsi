import type { INestApplication } from '@nestjs/common';
import { InMemoryMailTransport, MailTransport } from '@nestjs/mail';
import { OutboxRelay } from '@nestjs/outbox';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import { v7 as uuidv7 } from 'uuid';
import type { CreateSchoolDto } from '../../src/modules/schools/dto/school-settings.dto.js';
import { SchoolsService } from '../../src/modules/schools/schools.service.js';

export const ORIGIN = 'http://localhost:3000';
export const PASSWORD = 'correct-horse-battery';

export type Agent = TestAgent;

export const mailbox = (app: INestApplication) =>
  app.get(MailTransport) as InMemoryMailTransport;

/** Publishes committed outbox messages, so queued mail reaches the in-memory mailbox. */
export async function deliverMail(app: INestApplication): Promise<void> {
  await app.get(OutboxRelay).runOnce();
}

export const uniqueEmail = (label: string) =>
  `${label}-${uuidv7().slice(-8)}@example.test`;
export const uniqueSlug = (label: string) => `${label}-${uuidv7().slice(-8)}`;

export function agent(app: INestApplication): Agent {
  return request.agent(app.getHttpServer()).set('Origin', ORIGIN);
}

export async function signIn(
  app: INestApplication,
  email: string,
  password = PASSWORD,
): Promise<Agent> {
  const session = agent(app);
  await session
    .post('/api/auth/sign-in/email')
    .send({ email, password })
    .expect(200);
  return session;
}

/** The token in the most recent password link sent to `email`. */
export async function passwordToken(
  app: INestApplication,
  email: string,
): Promise<string> {
  await deliverMail(app);
  const mail = mailbox(app)
    .filter({ to: email })
    .findLast(
      (sent) =>
        sent.template === 'account-setup' || sent.template === 'reset-password',
    );
  if (!mail) throw new Error(`No password mail was sent to ${email}`);
  const link = mail.link('/api/auth/reset-password/');
  return link.pathname.split('/').pop()!;
}

export async function choosePassword(
  app: INestApplication,
  email: string,
  password = PASSWORD,
): Promise<void> {
  const token = await passwordToken(app, email);
  await agent(app)
    .post('/api/auth/reset-password')
    .send({ token, newPassword: password })
    .expect(200);
}

export interface CreatedSchool {
  id: string;
  slug: string;
  adminEmail: string;
  admin: Agent;
}

/** A school whose first admin has chosen a password and signed in. */
export async function createSchool(
  app: INestApplication,
  overrides: Partial<CreateSchoolDto> = {},
): Promise<CreatedSchool> {
  const dto: CreateSchoolDto = {
    name: 'Greenfield School',
    slug: uniqueSlug('greenfield'),
    adminName: 'Ada Admin',
    adminEmail: uniqueEmail('admin'),
    defaultLocale: 'en',
    timeZone: 'Europe/Paris',
    currency: 'EUR',
    ...overrides,
  };
  const school = await app.get(SchoolsService).create(dto);
  await choosePassword(app, dto.adminEmail);
  const admin = await signIn(app, dto.adminEmail);
  return {
    id: school.id,
    slug: school.slug,
    adminEmail: dto.adminEmail,
    admin,
  };
}

/** Signs up with email and password and follows the verification link, which signs in. */
export async function signUp(
  app: INestApplication,
  email: string,
  name = 'Test User',
): Promise<Agent> {
  const session = agent(app);
  await session
    .post('/api/auth/sign-up/email')
    .send({ email, name, password: PASSWORD })
    .expect(200);
  await deliverMail(app);
  const link = mailbox(app)
    .assertSent({ to: email, template: 'verify-email' })
    .link('/api/auth/verify-email');
  await session.get(`${link.pathname}${link.search}`).expect(302);
  return session;
}

/** Invites `email` to the school with `roles`, then signs them up and accepts. */
export async function addMember(
  app: INestApplication,
  school: CreatedSchool,
  roles: string[],
  email = uniqueEmail(roles[0]),
): Promise<{ email: string; session: Agent; userId: string }> {
  const { body: invitation } = await school.admin
    .post('/api/auth/organization/invite-member')
    .send({ email, role: roles, organizationId: school.id })
    .expect(200);
  const session = await signUp(app, email);
  await session
    .post('/api/auth/organization/accept-invitation')
    .send({ invitationId: invitation.id })
    .expect(200);
  const { body: me } = await session
    .get('/api/v1/me')
    .set('X-School-Slug', school.slug)
    .expect(200);
  return { email, session, userId: me.user.id };
}
