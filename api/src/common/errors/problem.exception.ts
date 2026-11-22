import { HttpException, HttpStatus } from '@nestjs/common';

export interface FieldError {
  field: string;
  codes: string[];
}

export interface ProblemBody {
  code: string;
  detail?: string;
  errors?: FieldError[];
}

/**
 * Throw this for any error the UI should explain. `code` is stable and
 * translated by the frontend; `detail` is for developers and logs only.
 */
export class ProblemException extends HttpException {
  constructor(
    status: HttpStatus,
    code: string,
    detail?: string,
    errors?: FieldError[],
  ) {
    super({ code, detail, errors } satisfies ProblemBody, status);
  }
}
