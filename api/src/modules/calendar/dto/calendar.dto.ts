import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  registerDecorator,
} from 'class-validator';
import { IsCalendarDate } from '../../../common/validation/is-calendar-date.js';
import {
  AUDIENCES,
  type AudienceKind,
  EVENT_KINDS,
  type EventKind,
} from '../entities/calendar-event.entity.js';
import { parseRecurrence } from '../recurrence.js';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function IsRecurrence() {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'isRecurrence',
      target: target.constructor,
      propertyName,
      options: { message: '$property must be a supported RRULE' },
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && parseRecurrence(value) !== null,
      },
    });
}

export class CalendarEventDto {
  @IsString()
  @Length(1, 200)
  title: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string | null;

  @IsIn(EVENT_KINDS)
  kind: EventKind;

  @IsCalendarDate()
  startsOn: string;

  @IsOptional()
  @IsCalendarDate()
  endsOn?: string;

  /** `HH:MM` in the school's time zone. Leave both times out for an all-day event. */
  @IsOptional()
  @Matches(TIME)
  startTime?: string | null;

  @IsOptional()
  @Matches(TIME)
  endTime?: string | null;

  @IsOptional()
  @IsRecurrence()
  recurrence?: string | null;

  @IsIn(AUDIENCES)
  audience: AudienceKind;

  @IsOptional()
  @IsUUID()
  audienceId?: string | null;
}

export class CalendarRangeDto {
  @IsCalendarDate()
  from: string;

  @IsCalendarDate()
  to: string;
}
