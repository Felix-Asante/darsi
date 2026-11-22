import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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
import {
  ROTATION_KINDS,
  type RotationKind,
} from '../entities/bell-schedule.entity.js';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class BellScheduleDto {
  @IsOptional()
  @IsUUID()
  divisionId?: string | null;

  @IsString()
  @Length(1, 80)
  name: string;

  @IsIn(ROTATION_KINDS)
  rotationKind: RotationKind;

  @IsInt()
  @Min(1)
  @Max(20)
  rotationLength: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  weekdays?: number[];
}

export class BellPeriodDto {
  @IsString()
  @Length(1, 40)
  name: string;

  @Matches(TIME)
  startsAt: string;

  @Matches(TIME)
  endsAt: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class TimetableSlotDto {
  @IsUUID()
  periodId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(140)
  cycleDay: number;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  room?: string | null;

  @IsOptional()
  @IsUUID()
  teacherUserId?: string | null;
}
