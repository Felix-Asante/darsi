import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
} from 'class-validator';

export class ReportTemplateDto {
  @IsOptional()
  @IsUUID()
  divisionId?: string | null;

  @IsString()
  @Length(1, 120)
  name: string;

  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  subjectIds: string[];

  @IsBoolean()
  includeAttendance: boolean;

  @IsBoolean()
  includeGeneralComment: boolean;
}

export class OpenReportsDto {
  @IsOptional()
  @IsUUID()
  divisionId?: string | null;

  @IsOptional()
  @IsIn(['en', 'fr'])
  locale?: 'en' | 'fr';
}

export class CommentDto {
  @IsUUID()
  studentId: string;

  @IsOptional()
  @IsString()
  @Length(0, 3000)
  comment?: string | null;
}

export class SaveCommentsDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CommentDto)
  comments: CommentDto[];
}

export class GeneralCommentDto {
  @IsOptional()
  @IsString()
  @Length(0, 3000)
  generalComment?: string | null;
}

export class ReturnDto {
  @IsString()
  @Length(1, 1000)
  note: string;
}
