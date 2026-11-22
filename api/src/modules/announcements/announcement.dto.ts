import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
import { CursorQueryDto } from '../../common/pagination/cursor-pagination.js';
import { type Role, ROLES } from '../auth/access-control.js';
import {
  ANNOUNCEMENT_AUDIENCES,
  type AnnouncementAudience,
} from './announcement.entities.js';

export class CreateAnnouncementDto {
  @IsString()
  @Length(1, 200)
  title: string;

  /** Tiptap JSON; anything not allowed is removed. */
  @IsObject()
  body: object;

  @IsIn(ANNOUNCEMENT_AUDIENCES)
  audience: AnnouncementAudience;

  @IsOptional()
  @IsUUID()
  audienceId?: string | null;

  @IsOptional()
  @IsIn(ROLES)
  audienceRole?: Role | null;

  /** School-local date and time, `2026-11-20T08:30`. Leave out to send now. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/)
  publishAt?: string | null;
}

export class ClassSettingsDto {
  @IsBoolean()
  assistantsCanPost: boolean;
}

export class FeedQueryDto extends CursorQueryDto {}
