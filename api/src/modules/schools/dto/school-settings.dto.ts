import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  Validate,
} from 'class-validator';
import { SCHOOL_LOCALES, type SchoolLocale } from '../school.entity.js';
import { IsCurrencyCode, IsTimeZone } from './validators.js';

export class UpdateSchoolDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  logo?: string;

  @IsOptional()
  @IsIn(SCHOOL_LOCALES)
  defaultLocale?: SchoolLocale;

  @IsOptional()
  @Validate(IsTimeZone)
  timeZone?: string;

  @IsOptional()
  @Validate(IsCurrencyCode)
  currency?: string;
}

export class CompleteOnboardingDto {
  @IsString()
  @Length(2, 120)
  name: string;

  @IsIn(SCHOOL_LOCALES)
  defaultLocale: SchoolLocale;

  @Validate(IsTimeZone)
  timeZone: string;

  @Validate(IsCurrencyCode)
  currency: string;
}

export class CreateSchoolDto {
  @IsString()
  @Length(2, 120)
  name: string;

  /** Becomes the subdomain: `greenfield` → greenfield.darsi.app. */
  @Matches(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/)
  slug: string;

  @IsString()
  @Length(1, 120)
  adminName: string;

  @IsEmail()
  adminEmail: string;

  @IsIn(SCHOOL_LOCALES)
  defaultLocale: SchoolLocale;

  @Validate(IsTimeZone)
  timeZone: string;

  @Validate(IsCurrencyCode)
  currency: string;
}
