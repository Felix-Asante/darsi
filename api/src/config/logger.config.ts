import type { Params } from 'nestjs-pino';
import { ClsServiceManager } from 'nestjs-cls';
import { requestIdFor } from '../common/http/request-id.js';
import { type EnvironmentVariables, NodeEnv } from './env.validation.js';

const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.token',
  '*.secret',
];

export function buildLoggerParams(
  env: Pick<EnvironmentVariables, 'NODE_ENV' | 'LOG_LEVEL'>,
): Params {
  return {
    pinoHttp: {
      level: env.LOG_LEVEL,
      genReqId: (request) => requestIdFor(request),
      customProps: () => {
        const cls = ClsServiceManager.getClsService();
        return cls.isActive()
          ? { schoolId: cls.get('schoolId'), userId: cls.get('userId') }
          : {};
      },
      redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
      autoLogging: {
        ignore: (request) => request.url?.startsWith('/health') ?? false,
      },
      transport:
        env.NODE_ENV === NodeEnv.Development
          ? {
              target: 'pino-pretty',
              options: { singleLine: true, ignore: 'pid,hostname' },
            }
          : undefined,
    },
  };
}
