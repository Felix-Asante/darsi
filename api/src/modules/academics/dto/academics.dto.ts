import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsCalendarDate } from '../../../common/validation/is-calendar-date.js';
import {
  CLASS_STAFF_ROLES,
  type ClassStaffRole,
} from '../entities/class-staff.entity.js';

export class CreateAcademicYearDto {
  @IsString()
  @Length(1, 60)
  name: string;

  @IsCalendarDate()
  startsOn: string;

  @IsCalendarDate()
  endsOn: string;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}

export class UpdateAcademicYearDto {
  @IsOptional()
  @IsString()
  @Length(1, 60)
  name?: string;

  @IsOptional()
  @IsCalendarDate()
  startsOn?: string;

  @IsOptional()
  @IsCalendarDate()
  endsOn?: string;
}

export class DivisionDto {
  @IsString()
  @Length(1, 80)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class GradeLevelDto {
  @IsUUID()
  divisionId: string;

  @IsString()
  @Length(1, 80)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

const CODE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;

export class SubjectDto {
  @Matches(CODE)
  code: string;

  @IsString()
  @Length(1, 120)
  name: string;
}

export class CreateClassDto {
  @IsUUID()
  academicYearId: string;

  @IsOptional()
  @IsUUID()
  gradeLevelId?: string | null;

  @IsOptional()
  @IsUUID()
  subjectId?: string | null;

  @Matches(CODE)
  code: string;

  @IsString()
  @Length(1, 120)
  name: string;
}

export class UpdateClassDto {
  @IsOptional()
  @IsUUID()
  gradeLevelId?: string | null;

  @IsOptional()
  @IsUUID()
  subjectId?: string | null;

  @IsOptional()
  @Matches(CODE)
  code?: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;
}

export class ClassStaffMemberDto {
  @IsUUID()
  userId: string;

  @IsIn(CLASS_STAFF_ROLES)
  role: ClassStaffRole;
}

export class SetClassStaffDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ClassStaffMemberDto)
  staff: ClassStaffMemberDto[];
}

export class ListClassesQueryDto {
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  /** Only classes the signed-in user works in. */
  @IsOptional()
  @IsIn(['true', 'false'])
  mine?: 'true' | 'false';
}

export class TermDto {
  @IsString()
  @Length(1, 60)
  name: string;

  @IsCalendarDate()
  startsOn: string;

  @IsCalendarDate()
  endsOn: string;
}
