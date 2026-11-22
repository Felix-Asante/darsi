import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
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
  ValidateNested,
} from 'class-validator';
import { IsCalendarDate } from '../../../common/validation/is-calendar-date.js';
import {
  ATTENDANCE_MODES,
  type AttendanceMode,
  COUNTS_AS,
  type CountsAs,
} from '../entities/attendance.entities.js';

export class AttendanceSettingsDto {
  @IsIn(ATTENDANCE_MODES)
  mode: AttendanceMode;

  @IsInt()
  @Min(0)
  @Max(1440)
  notifyAfterMinutes: number;
}

export class AttendanceStatusDto {
  @Matches(/^[a-z][a-z0-9_]{1,29}$/)
  code: string;

  @IsString()
  @Length(1, 60)
  label: string;

  @IsIn(COUNTS_AS)
  countsAs: CountsAs;
}

export class SessionQueryDto {
  @IsCalendarDate()
  date: string;

  @IsOptional()
  @IsUUID()
  periodId?: string;
}

export class RecordDto {
  @IsUUID()
  studentId: string;

  @IsString()
  @Length(1, 30)
  status: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  reason?: string | null;
}

export class TakeAttendanceDto {
  @IsCalendarDate()
  date: string;

  @IsOptional()
  @IsUUID()
  periodId?: string | null;

  /** Students left out are present. */
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => RecordDto)
  records: RecordDto[];
}

export class AbsenceReasonDto {
  @IsCalendarDate()
  date: string;

  @IsString()
  @Length(1, 500)
  reason: string;
}

export class RangeDto {
  @IsCalendarDate()
  from: string;

  @IsCalendarDate()
  to: string;
}

export class ReportQueryDto extends RangeDto {
  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsUUID()
  gradeLevelId?: string;
}
