import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { RequirePermission } from '../auth/auth.decorators.js';
import { DriveService } from './drive.service.js';
import {
  AttachmentsDto,
  AttachmentsQueryDto,
  CreateUploadDto,
  DownloadQueryDto,
  FolderDto,
  FolderQueryDto,
  StudentFileDto,
  UpdateDriveItemDto,
} from './files.dto.js';
import { FilesService } from './files.service.js';

const id = new ParseUUIDPipe({ version: '7' });

/** Permissions depend on where a file is used, so the services check them. */
@Controller()
export class FilesController {
  constructor(
    private readonly files: FilesService,
    private readonly drive: DriveService,
  ) {}

  @Post('files/uploads')
  createUpload(@Body() dto: CreateUploadDto) {
    return this.files.createUpload(dto);
  }

  @Post('files/:id/complete')
  @HttpCode(HttpStatus.OK)
  complete(@Param('id', id) fileId: string) {
    return this.files.complete(fileId);
  }

  @Get('files/:id/download')
  download(
    @Param('id', id) fileId: string,
    @Query() { inline }: DownloadQueryDto,
  ) {
    return this.files.download(fileId, inline === 'true');
  }

  @Get('files/usage')
  @RequirePermission({ school: ['manage'] })
  usage() {
    return this.files.usage();
  }

  @Get('drive/classes/:id')
  list(
    @Param('id', id) classId: string,
    @Query() { folderId }: FolderQueryDto,
  ) {
    return this.drive.list(classId, folderId);
  }

  @Post('drive/classes/:id/folders')
  createFolder(@Param('id', id) classId: string, @Body() dto: FolderDto) {
    return this.drive.createFolder(classId, dto);
  }

  @Patch('drive/items/:id')
  updateItem(@Param('id', id) itemId: string, @Body() dto: UpdateDriveItemDto) {
    return this.drive.update(itemId, dto);
  }

  @Delete('drive/items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeItem(@Param('id', id) itemId: string) {
    return this.drive.remove(itemId);
  }

  @Get('drive/attachments')
  attachments(@Query() { targetType, targetId }: AttachmentsQueryDto) {
    return this.drive.attachments(targetType, targetId);
  }

  @Put('drive/attachments')
  setAttachments(
    @Body() { targetType, targetId, driveItemIds }: AttachmentsDto,
  ) {
    return this.drive.setAttachments(targetType, targetId, driveItemIds);
  }

  @Get('students/:id/files')
  studentFiles(@Param('id', id) studentId: string) {
    return this.files.studentFiles(studentId);
  }

  @Patch('student-files/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  updateStudentFile(
    @Param('id', id) entryId: string,
    @Body() dto: StudentFileDto,
  ) {
    return this.files.updateStudentFile(entryId, dto);
  }

  @Delete('student-files/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeStudentFile(@Param('id', id) entryId: string) {
    return this.files.removeStudentFile(entryId);
  }
}
