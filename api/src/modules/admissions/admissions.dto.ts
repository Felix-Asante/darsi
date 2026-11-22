import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
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
import {
  RELATIONSHIPS,
  type Relationship,
} from '../people/entities/guardian-link.entity.js';
import { IsCalendarDate } from '../../common/validation/is-calendar-date.js';
import {
  FIELD_TYPES,
  type FieldType,
  STAGE_KINDS,
  type StageKind,
} from './admissions.entities.js';

const KEY = /^[a-z][a-z0-9_]{0,39}$/;

export class CycleGradeDto {
  @IsUUID()
  gradeLevelId: string;

  @IsInt()
  @Min(0)
  @Max(10_000)
  places: number;
}

export class CycleDto {
  @IsUUID()
  academicYearId: string;

  @IsString()
  @Length(1, 120)
  name: string;

  @IsCalendarDate()
  opensOn: string;

  @IsCalendarDate()
  closesOn: string;

  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => CycleGradeDto)
  grades: CycleGradeDto[];

  /** Minor units; "0" for no fee. */
  @Matches(/^\d{1,15}$/)
  applicationFee: string;

  @IsOptional()
  @IsUUID()
  depositFeeItemId?: string | null;
}

export class LabelDto {
  @IsString()
  @Length(1, 200)
  en: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  fr?: string;
}

export class FormFieldDto {
  @Matches(KEY)
  key: string;

  @ValidateNested()
  @Type(() => LabelDto)
  label: LabelDto;

  @IsIn(FIELD_TYPES)
  type: FieldType;

  @IsBoolean()
  required: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @Length(1, 100, { each: true })
  options?: string[];
}

export class FormDocumentDto {
  @Matches(KEY)
  key: string;

  @ValidateNested()
  @Type(() => LabelDto)
  label: LabelDto;

  @IsBoolean()
  required: boolean;
}

export class FormDto {
  @IsOptional()
  @IsUUID()
  divisionId?: string | null;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  fields: FormFieldDto[];

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => FormDocumentDto)
  documents: FormDocumentDto[];
}

export class StageEmailCopyDto {
  @IsString()
  @Length(1, 200)
  subject: string;

  @IsString()
  @Length(1, 5000)
  body: string;
}

export class StageEmailDto {
  @ValidateNested()
  @Type(() => StageEmailCopyDto)
  en: StageEmailCopyDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => StageEmailCopyDto)
  fr?: StageEmailCopyDto;
}

export class StageDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @Length(1, 80)
  name: string;

  @IsIn(STAGE_KINDS)
  kind: StageKind;

  @IsOptional()
  @ValidateNested()
  @Type(() => StageEmailDto)
  email?: StageEmailDto | null;
}

export class StagesDto {
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => StageDto)
  stages: StageDto[];
}

/** What a family fills in. Everything is optional until they submit. */
export class ApplicationDto {
  @IsUUID()
  cycleId: string;

  @IsUUID()
  gradeLevelId: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  studentFirstName?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  studentLastName?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  studentPreferredName?: string | null;

  @IsOptional()
  @IsCalendarDate()
  studentDateOfBirth?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  guardianFirstName?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  guardianLastName?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 40)
  guardianPhone?: string | null;

  @IsOptional()
  @IsIn(RELATIONSHIPS)
  guardianRelationship?: Relationship | null;

  @IsOptional()
  @IsObject()
  answers?: Record<string, string | boolean>;
}

export class DocumentDto {
  @IsUUID()
  fileId: string;
}

export class ApplicationQueryDto {
  @IsOptional()
  @IsUUID()
  cycleId?: string;

  @IsOptional()
  @IsUUID()
  stageId?: string;

  @IsOptional()
  @IsUUID()
  gradeLevelId?: string;
}

export class MoveDto {
  @IsUUID()
  stageId: string;

  /** Required when the stage is an offer (ADMS-9). */
  @IsOptional()
  @IsCalendarDate()
  offerExpiresOn?: string;
}

export class NoteDto {
  @IsIn(['note', 'rating', 'interview'])
  kind: 'note' | 'rating' | 'interview';

  @IsString()
  @Length(1, 5000)
  body: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}

export class OfferResponseDto {
  @IsIn(['accepted', 'declined'])
  response: 'accepted' | 'declined';
}

export class ReEnrolmentRunDto {
  @IsUUID()
  academicYearId: string;
}

export class ReEnrolmentResponseDto {
  @IsIn(['confirmed', 'declined'])
  response: 'confirmed' | 'declined';
}

export class WithdrawalDto {
  @IsCalendarDate()
  leavingOn: string;

  @IsString()
  @Length(1, 500)
  reason: string;
}
