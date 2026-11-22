import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import { CursorQueryDto } from '../../common/pagination/cursor-pagination.js';
import { ITEM_KINDS, type ItemKind } from './portfolio.entities.js';

export class PortfolioItemDto {
  /** A student's portfolio, or leave out for the class portfolio. */
  @IsOptional()
  @IsUUID()
  studentId?: string | null;

  @IsOptional()
  @IsUUID()
  classId?: string | null;

  @IsIn(ITEM_KINDS)
  kind: ItemKind;

  @IsString()
  @Length(1, 200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url?: string | null;

  @IsOptional()
  @IsObject()
  body?: object | null;

  @IsOptional()
  @IsUUID()
  fileId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Length(1, 40, { each: true })
  tags?: string[];
}

export class PortfolioCommentDto {
  @IsString()
  @Length(1, 2000)
  body: string;
}

export class PortfolioSettingsDto {
  @IsBoolean()
  approvalRequired: boolean;
}

export class ItemsQueryDto extends CursorQueryDto {}
