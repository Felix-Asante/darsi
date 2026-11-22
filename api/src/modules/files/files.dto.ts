import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  ATTACHMENT_TARGETS,
  type AttachmentTarget,
  DRIVE_AUDIENCES,
  type DriveAudience,
} from './entities/files.entities.js';

export class UploadTargetDto {
  @IsIn(['drive', 'student', 'submission', 'portfolio', 'application'])
  type: 'drive' | 'student' | 'submission' | 'portfolio' | 'application';

  /** Drive: the class, and optionally the folder. */
  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsArray()
  @IsIn(DRIVE_AUDIENCES, { each: true })
  visibility?: DriveAudience[];

  /** Student files: the student, a title, and whether the family sees it. */
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsBoolean()
  visibleToFamily?: boolean;

  /** Admissions: the signed-in family's application. */
  @IsOptional()
  @IsUUID()
  applicationId?: string;

  /** Submissions: the assessment the signed-in student hands work in for. */
  @IsOptional()
  @IsUUID()
  assessmentId?: string;
}

export class CreateUploadDto {
  @IsString()
  @Length(1, 200)
  name: string;

  @IsString()
  @Length(1, 120)
  contentType: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2 * 1024 ** 3)
  size: number;

  @ValidateNested()
  @Type(() => UploadTargetDto)
  target: UploadTargetDto;
}

export class DownloadQueryDto {
  @IsOptional()
  @IsIn(['true', 'false'])
  inline?: 'true' | 'false';
}

export class FolderDto {
  @IsString()
  @Length(1, 200)
  name: string;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsArray()
  @IsIn(DRIVE_AUDIENCES, { each: true })
  visibility?: DriveAudience[];
}

export class UpdateDriveItemDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  /** Moves the item; null moves it to the top of the drive. */
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsArray()
  @IsIn(DRIVE_AUDIENCES, { each: true })
  visibility?: DriveAudience[];
}

export class AttachmentsDto {
  @IsIn(ATTACHMENT_TARGETS)
  targetType: AttachmentTarget;

  @IsUUID()
  targetId: string;

  @IsArray()
  @ArrayMaxSize(30)
  @IsUUID('all', { each: true })
  driveItemIds: string[];
}

export class AttachmentsQueryDto {
  @IsIn(ATTACHMENT_TARGETS)
  targetType: AttachmentTarget;

  @IsUUID()
  targetId: string;
}

export class StudentFileDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsBoolean()
  visibleToFamily?: boolean;
}

export class FolderQueryDto {
  @IsOptional()
  @IsUUID()
  folderId?: string;
}
