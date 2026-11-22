import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsCalendarDate } from '../../../common/validation/is-calendar-date.js';
import {
  ASSESSMENT_KINDS,
  type AssessmentKind,
} from '../entities/assessment.entity.js';

export class CriterionDto {
  @IsString()
  @Length(1, 120)
  name: string;

  @IsUUID()
  scaleId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weight?: number;
}

export class CreateAssessmentDto {
  @IsString()
  @Length(1, 200)
  title: string;

  @IsOptional()
  @IsString()
  @Length(0, 5000)
  description?: string | null;

  @IsIn(ASSESSMENT_KINDS)
  kind: AssessmentKind;

  @IsOptional()
  @IsCalendarDate()
  dueOn?: string | null;

  @IsUUID()
  scaleId: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weight?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => CriterionDto)
  criteria?: CriterionDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  standardIds?: string[];
}

export class UpdateAssessmentDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(0, 5000)
  description?: string | null;

  @IsOptional()
  @IsIn(ASSESSMENT_KINDS)
  kind?: AssessmentKind;

  @IsOptional()
  @IsCalendarDate()
  dueOn?: string | null;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weight?: number;
}

export class GradeEntryDto {
  @IsUUID()
  studentId: string;

  /** On the assessment's scale. Leave out for a rubric (criteria give the result) or to clear. */
  @IsOptional()
  @IsString()
  @Length(0, 20)
  value?: string | null;

  /** Rubric criterion id → value on that criterion's scale. */
  @IsOptional()
  criterionValues?: Record<string, string>;

  @IsOptional()
  @IsString()
  @Length(0, 5000)
  comment?: string | null;

  @IsOptional()
  @IsBoolean()
  excused?: boolean;
}

export class SaveGradesDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => GradeEntryDto)
  grades: GradeEntryDto[];

  /** Publish these grades now. Needs the right to publish; teaching assistants save drafts. */
  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

export class TermQueryDto {
  @IsOptional()
  @IsUUID()
  termId?: string;
}

export class SubmissionDto {
  @IsString()
  @Length(1, 20000)
  body: string;
}
