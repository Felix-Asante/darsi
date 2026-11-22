import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsString, Min, ValidateNested } from 'class-validator';
import { ProblemException } from '../errors/problem.exception.js';
import { createValidationPipe } from './validation.pipe.js';

class GuardianDto {
  @IsEmail()
  email: string;
}

class CreateStudentDto {
  @IsString()
  name: string;

  @Type(() => Number)
  @IsInt()
  @Min(3)
  age: number;

  @ValidateNested()
  @Type(() => GuardianDto)
  guardian: GuardianDto;
}

const validate = (value: unknown) =>
  createValidationPipe().transform(value, {
    type: 'body',
    metatype: CreateStudentDto,
  });

describe('createValidationPipe', () => {
  it('transforms a valid body into the DTO', async () => {
    const result = await validate({
      name: 'Amira',
      age: '7',
      guardian: { email: 'a@b.co' },
    });

    expect(result).toBeInstanceOf(CreateStudentDto);
    expect(result.age).toBe(7);
  });

  it('reports every invalid field with stable codes, including nested ones', async () => {
    const error = await validate({
      name: 3,
      age: 1,
      guardian: { email: 'nope' },
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ProblemException);
    expect((error as ProblemException).getResponse()).toMatchObject({
      code: 'validation_failed',
      errors: [
        { field: 'name', codes: ['isString'] },
        { field: 'age', codes: ['min'] },
        { field: 'guardian.email', codes: ['isEmail'] },
      ],
    });
  });

  it('rejects properties the DTO does not declare', async () => {
    const error = await validate({
      name: 'A',
      age: 5,
      guardian: { email: 'a@b.co' },
      isAdmin: true,
    }).catch((e: unknown) => e);

    expect((error as ProblemException).getResponse()).toMatchObject({
      errors: [{ field: 'isAdmin', codes: ['whitelistValidation'] }],
    });
  });
});
