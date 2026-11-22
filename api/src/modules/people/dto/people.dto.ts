import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { IsCalendarDate } from '../../../common/validation/is-calendar-date.js';
import {
  RELATIONSHIPS,
  type Relationship,
} from '../entities/guardian-link.entity.js';

const STUDENT_NUMBER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;

export class CreateStudentDto {
  @Matches(STUDENT_NUMBER)
  studentNumber: string;

  @IsString()
  @Length(1, 80)
  firstName: string;

  @IsString()
  @Length(1, 80)
  lastName: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  preferredName?: string | null;

  @IsOptional()
  @IsCalendarDate()
  dateOfBirth?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsUUID()
  gradeLevelId?: string | null;

  @IsOptional()
  @IsCalendarDate()
  enrolledOn?: string | null;
}

export class UpdateStudentDto {
  @IsOptional()
  @Matches(STUDENT_NUMBER)
  studentNumber?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  lastName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  preferredName?: string | null;

  @IsOptional()
  @IsCalendarDate()
  dateOfBirth?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsUUID()
  gradeLevelId?: string | null;
}

export class ListStudentsQueryDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  search?: string;

  @IsOptional()
  @IsUUID()
  gradeLevelId?: string;

  @IsOptional()
  @IsIn(['active', 'withdrawn'])
  status?: 'active' | 'withdrawn';

  /** The `nextCursor` of the previous page. */
  @IsOptional()
  @IsString()
  @Length(1, 400)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50;
}

export class CreateGuardianDto {
  @IsString()
  @Length(1, 80)
  firstName: string;

  @IsString()
  @Length(1, 80)
  lastName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @Length(3, 40)
  phone?: string | null;

  @IsOptional()
  @IsIn(['en', 'fr'])
  preferredLocale?: 'en' | 'fr';
}

export class UpdateGuardianDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Length(3, 40)
  phone?: string | null;

  @IsOptional()
  @IsIn(['en', 'fr'])
  preferredLocale?: 'en' | 'fr';
}

export class ListGuardiansQueryDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  search?: string;
}

export class LinkGuardianDto {
  @IsUUID()
  guardianId: string;

  @IsIn(RELATIONSHIPS)
  relationship: Relationship;

  @IsOptional()
  @IsBoolean()
  isPrimaryContact?: boolean;
}

export class UpdateFamilyDto {
  @IsString()
  @Length(1, 120)
  name: string;
}

export class EnrolStudentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  studentIds: string[];

  @IsOptional()
  @IsCalendarDate()
  startsOn?: string;
}
