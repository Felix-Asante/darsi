import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { toProblemFromDatabase } from '../errors/database-errors.js';
import type { FieldError, ProblemBody } from '../errors/problem.exception.js';
import { RequestContext } from '../tenancy/request-context.js';

const DEFAULT_CODES: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'bad_request',
  [HttpStatus.UNAUTHORIZED]: 'unauthenticated',
  [HttpStatus.FORBIDDEN]: 'forbidden',
  [HttpStatus.NOT_FOUND]: 'not_found',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'method_not_allowed',
  [HttpStatus.CONFLICT]: 'conflict',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'payload_too_large',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'unprocessable',
  [HttpStatus.TOO_MANY_REQUESTS]: 'rate_limited',
};

const reasonPhrase = (status: number) =>
  (HttpStatus[status] ?? 'Error')
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  instance: string;
  requestId?: string;
  errors?: FieldError[];
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  constructor(private readonly context: RequestContext) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const problem = this.toProblem(exception, request);
    if (problem.status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : exception,
      );
    }

    response
      .status(problem.status)
      .type('application/problem+json')
      .json(problem);
  }

  private toProblem(exception: unknown, request: Request): ProblemDetails {
    const base = {
      instance: request.originalUrl,
      requestId: this.context.requestId,
    };

    exception = toProblemFromDatabase(exception) ?? exception;

    if (!(exception instanceof HttpException)) {
      return {
        ...base,
        type: 'about:blank',
        title: 'Internal Server Error',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'internal_error',
      };
    }

    const status = exception.getStatus();
    const body = exception.getResponse();
    const problem =
      typeof body === 'object' ? (body as Partial<ProblemBody>) : {};
    const code =
      problem.code ??
      DEFAULT_CODES[status] ??
      (status >= 500 ? 'internal_error' : 'error');

    return {
      ...base,
      type: 'about:blank',
      title: reasonPhrase(status),
      status,
      code,
      detail: status >= 500 ? undefined : (problem.detail ?? exception.message),
      errors: problem.errors,
    };
  }
}
