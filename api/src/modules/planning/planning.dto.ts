import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsCalendarDate } from '../../common/validation/is-calendar-date.js';
import {
  COLLABORATOR_ROLES,
  type CollaboratorRole,
} from './planning.entities.js';

export class TemplateFieldDto {
  @Matches(/^[a-z][a-z0-9_]{0,39}$/)
  key: string;

  @IsString()
  @Length(1, 120)
  label: string;

  @IsIn(['text', 'richtext'])
  kind: 'text' | 'richtext';
}

export class TemplateDto {
  @IsString()
  @Length(1, 120)
  name: string;

  @IsOptional()
  @IsUUID()
  frameworkId?: string | null;

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => TemplateFieldDto)
  fields: TemplateFieldDto[];
}

export class UnitDto {
  @IsString()
  @Length(1, 200)
  title: string;

  @IsOptional()
  @IsUUID()
  templateId?: string | null;

  @IsOptional()
  @IsCalendarDate()
  startsOn?: string | null;

  @IsOptional()
  @IsCalendarDate()
  endsOn?: string | null;

  @IsOptional()
  @IsObject()
  objectives?: object | null;

  @IsOptional()
  @IsObject()
  fieldValues?: Record<string, unknown>;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  classIds: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  standardIds?: string[];
}

export class CollaboratorDto {
  @IsUUID()
  userId: string;

  @IsIn(COLLABORATOR_ROLES)
  role: CollaboratorRole;
}

export class CollaboratorsDto {
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CollaboratorDto)
  collaborators: CollaboratorDto[];
}

export class LinkAssessmentsDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  assessmentIds: string[];
}

export class CopyUnitDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  classIds: string[];

  /** Moves every date by this many days, such as 364 for the same weekday next year. */
  @IsOptional()
  @IsInt()
  @Min(-730)
  @Max(730)
  shiftDays?: number;
}

export class LessonDto {
  @IsString()
  @Length(1, 200)
  title: string;

  @IsOptional()
  @IsCalendarDate()
  date?: string | null;

  @IsOptional()
  @IsObject()
  objectives?: object | null;

  @IsOptional()
  @IsObject()
  activities?: object | null;

  @IsOptional()
  @IsObject()
  resources?: object | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
