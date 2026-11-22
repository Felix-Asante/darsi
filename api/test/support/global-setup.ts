import { execFileSync } from 'node:child_process';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer, Wait } from 'testcontainers';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    migratorUrl: string;
    redisUrl: string;
    s3Endpoint: string;
    gotenbergUrl: string;
  }
}

const RUNTIME_USER = 'darsi_app';
const RUNTIME_PASSWORD = 'runtime_test_password';

export default async function setup(project: TestProject) {
  const [postgres, redis, s3, gotenberg] = await Promise.all([
    new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('darsi')
      .withUsername('darsi_owner')
      .withPassword('owner_test_password')
      .start(),
    new GenericContainer('redis:7-alpine').withExposedPorts(6379).start(),
    // An S3-compatible server standing in for Cloudflare R2.
    new GenericContainer('chrislusf/seaweedfs:4.54')
      .withCommand(['server', '-s3', '-dir=/data'])
      .withExposedPorts(8333)
      .withWaitStrategy(
        Wait.forHttp('/', 8333).forStatusCodeMatching(() => true),
      )
      .start(),
    new GenericContainer('gotenberg/gotenberg:8.40.0')
      .withExposedPorts(3000)
      .withWaitStrategy(Wait.forHttp('/health', 3000))
      .start(),
  ]);

  const migratorUrl = postgres.getConnectionUri();
  const databaseUrl = Object.assign(new URL(migratorUrl), {
    username: RUNTIME_USER,
    password: RUNTIME_PASSWORD,
  }).toString();
  const redisUrl = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`;

  execFileSync('npx', ['nest', 'build'], { stdio: 'inherit' });
  execFileSync('node', ['dist/database/run-migrations.js'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      DATABASE_MIGRATOR_URL: migratorUrl,
    },
  });

  project.provide('databaseUrl', databaseUrl);
  project.provide('migratorUrl', migratorUrl);
  project.provide('redisUrl', redisUrl);
  project.provide(
    'gotenbergUrl',
    `http://${gotenberg.getHost()}:${gotenberg.getMappedPort(3000)}`,
  );
  project.provide(
    's3Endpoint',
    `http://${s3.getHost()}:${s3.getMappedPort(8333)}`,
  );

  return async () => {
    await Promise.all([
      postgres.stop(),
      redis.stop(),
      s3.stop(),
      gotenberg.stop(),
    ]);
  };
}
