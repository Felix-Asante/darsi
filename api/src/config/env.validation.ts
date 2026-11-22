import { plainToInstance, Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export enum LogLevel {
  Fatal = 'fatal',
  Error = 'error',
  Warn = 'warn',
  Info = 'info',
  Debug = 'debug',
  Trace = 'trace',
}

export enum MailTransportKind {
  File = 'file',
  Log = 'log',
  Resend = 'resend',
  Memory = 'memory',
}

export enum MalwareScannerKind {
  ClamAV = 'clamav',
  /** Detects only the EICAR test signature. For automated tests; refused in production. */
  Test = 'test',
}

const HTTP_URL = {
  protocols: ['http', 'https'],
  require_tld: false,
  require_protocol: true,
};
const DB_URL = { protocols: ['postgres', 'postgresql'], require_tld: false };
const REDIS_URL = { protocols: ['redis', 'rediss'], require_tld: false };

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt()
  @Min(0)
  @Max(65535)
  PORT: number = 8080;

  /** Connects as the non-owner runtime role, so row-level security applies. */
  @IsUrl(DB_URL)
  DATABASE_URL: string;

  /** Connects as the schema owner. Used only to run migrations. */
  @IsOptional()
  @IsUrl(DB_URL)
  DATABASE_MIGRATOR_URL?: string;

  @IsUrl(REDIS_URL)
  REDIS_URL: string;

  /** Comma-separated origins allowed by CORS. A `*.` prefix matches any subdomain. */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean)
      : value,
  )
  @IsString({ each: true })
  CORS_ORIGINS: string[] = [];

  @IsEnum(LogLevel)
  LOG_LEVEL: LogLevel = LogLevel.Info;

  /** Public URL of this API; Better Auth builds its links from it. */
  @IsUrl(HTTP_URL)
  API_URL: string;

  /** Public URL of the web app, where email links land. */
  @IsUrl(HTTP_URL)
  APP_URL: string;

  @IsString()
  @MinLength(32)
  AUTH_SECRET: string;

  /** `.darsi.app` in production, so school subdomains share the session. Unset locally. */
  @IsOptional()
  @IsString()
  COOKIE_DOMAIN?: string;

  @IsOptional()
  @IsString()
  GOOGLE_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  GOOGLE_CLIENT_SECRET?: string;

  /** Enables Cloudflare Turnstile on sign-up and password reset. */
  @IsOptional()
  @IsString()
  TURNSTILE_SECRET_KEY?: string;

  @IsEnum(MailTransportKind)
  MAIL_TRANSPORT: MailTransportKind = MailTransportKind.File;

  @IsOptional()
  @IsString()
  RESEND_API_KEY?: string;

  @IsString()
  MAIL_FROM: string = 'Darsi <no-reply@mail.darsi.app>';

  /** S3-compatible object storage (Cloudflare R2 in production). Files are unavailable when unset. */
  @IsOptional()
  @IsUrl(HTTP_URL)
  S3_ENDPOINT?: string;

  @IsString()
  S3_REGION: string = 'auto';

  @IsString()
  S3_BUCKET: string = 'darsi';

  @IsOptional()
  @IsString()
  S3_ACCESS_KEY_ID?: string;

  @IsOptional()
  @IsString()
  S3_SECRET_ACCESS_KEY?: string;

  /** Path-style URLs, for local S3 servers. R2 works either way. */
  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  S3_FORCE_PATH_STYLE: boolean = false;

  @IsEnum(MalwareScannerKind)
  MALWARE_SCANNER: MalwareScannerKind = MalwareScannerKind.ClamAV;

  @IsString()
  CLAMAV_HOST: string = 'localhost';

  @IsInt()
  @Min(1)
  @Max(65535)
  CLAMAV_PORT: number = 3310;

  /** Gotenberg, which turns report HTML into PDF. Reports can't be published without it. */
  @IsOptional()
  @IsUrl(HTTP_URL)
  GOTENBERG_URL?: string;

  /** Darsi's Stripe platform key; each school connects its own account (Connect Standard). */
  @IsOptional()
  @IsString()
  STRIPE_SECRET_KEY?: string;

  /** Signs Stripe webhooks; a webhook that fails the check is refused. */
  @IsOptional()
  @IsString()
  STRIPE_WEBHOOK_SECRET?: string;

  /** Storage each school gets unless it has its own quota. */
  @IsInt()
  @Min(0)
  FILE_QUOTA_BYTES: number = 10 * 1024 ** 3;
}

export function validateEnv(config: Record<string, unknown>) {
  const env = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(env, { skipMissingProperties: false });

  if (
    env.NODE_ENV === NodeEnv.Production &&
    env.MALWARE_SCANNER === MalwareScannerKind.Test
  ) {
    throw new Error(
      'Invalid environment variables:\n  MALWARE_SCANNER: "test" is not allowed in production',
    );
  }
  if (errors.length > 0) {
    const details = errors
      .map(
        (error) =>
          `${error.property}: ${Object.values(error.constraints ?? {}).join(', ')}`,
      )
      .join('\n  ');
    throw new Error(`Invalid environment variables:\n  ${details}`);
  }
  return env;
}
