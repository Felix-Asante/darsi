import {
  HttpStatus,
  ValidationPipe,
  type ValidationError,
} from '@nestjs/common';
import {
  type FieldError,
  ProblemException,
} from '../errors/problem.exception.js';

function flatten(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = error.constraints
      ? [{ field, codes: Object.keys(error.constraints) }]
      : [];
    return [...own, ...flatten(error.children ?? [], field)];
  });
}

export const createValidationPipe = () =>
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) =>
      new ProblemException(
        HttpStatus.BAD_REQUEST,
        'validation_failed',
        'The request body or query is invalid',
        flatten(errors),
      ),
  });
