import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { SCALE_PRESETS } from '../grading/presets.js';
import {
  AGGREGATION_METHODS,
  type AggregationMethod,
  SCALE_KINDS,
  type ScaleKind,
} from '../grading/types.js';

export class ScaleLevelDto {
  @IsString()
  @Length(1, 20)
  code: string;

  @IsOptional()
  @IsString()
  @Length(0, 80)
  label?: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  minMastery: number;
}

export class ScaleDefinitionDto {
  @IsIn(SCALE_KINDS)
  kind: ScaleKind;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  maxPoints?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  decimals?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ScaleLevelDto)
  levels?: ScaleLevelDto[];
}

export class CreateScaleDto {
  @IsString()
  @Length(1, 80)
  name: string;

  /** Start from a common scheme instead of a definition. */
  @IsOptional()
  @IsIn(Object.keys(SCALE_PRESETS))
  preset?: keyof typeof SCALE_PRESETS;

  @IsOptional()
  @ValidateNested()
  @Type(() => ScaleDefinitionDto)
  definition?: ScaleDefinitionDto;
}

export class UpdateScaleDto {
  @IsString()
  @Length(1, 80)
  name: string;

  @ValidateNested()
  @Type(() => ScaleDefinitionDto)
  definition: ScaleDefinitionDto;
}

export class ConversionDto {
  @IsUUID()
  fromScaleId: string;

  @IsUUID()
  toScaleId: string;

  /** Source value → target value. Values left out convert by mastery. */
  @IsObject()
  mapping: Record<string, string>;
}

export class ConvertPreviewDto {
  @IsUUID()
  fromScaleId: string;

  @IsUUID()
  toScaleId: string;

  @IsString()
  @Length(1, 20)
  value: string;
}

export class CategoryDto {
  @IsString()
  @Length(1, 60)
  name: string;

  @IsInt()
  @Min(0)
  @Max(1000)
  weight: number;
}

export class PolicyDto {
  /** Null for the school's default. */
  @IsOptional()
  @IsUUID()
  subjectId?: string | null;

  @IsOptional()
  @IsUUID()
  reportingScaleId?: string | null;

  @IsIn(AGGREGATION_METHODS)
  method: AggregationMethod;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CategoryDto)
  categories: CategoryDto[];
}
