import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { createTestApp } from './support/create-test-app.js';

describe('Platform (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports liveness without touching dependencies', async () => {
    await request(app.getHttpServer())
      .get('/health/live')
      .expect(200, { status: 'ok', info: {}, error: {}, details: {} });
  });

  it('reports readiness of the database and Redis', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200);

    expect(body.details).toMatchObject({
      database: { status: 'up' },
      redis: { status: 'up' },
    });
  });

  it('answers errors as RFC 9457 problem details with a stable code and the request id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/does-not-exist')
      .set('x-request-id', 'test-request-0001')
      .expect(404)
      .expect('content-type', /application\/problem\+json/);

    expect(response.body).toMatchObject({
      status: 404,
      title: 'Not Found',
      code: 'not_found',
      instance: '/api/v1/does-not-exist',
      requestId: 'test-request-0001',
    });
  });

  it('allows credentialed CORS only from configured origins', async () => {
    const allowed = await request(app.getHttpServer())
      .get('/health/live')
      .set('Origin', 'http://localhost:3000');
    const blocked = await request(app.getHttpServer())
      .get('/health/live')
      .set('Origin', 'https://evil.example');

    expect(allowed.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('sends security headers', async () => {
    const response = await request(app.getHttpServer()).get('/health/live');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['strict-transport-security']).toBeDefined();
  });
});
