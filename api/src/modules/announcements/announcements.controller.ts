import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { IsOptional, IsString, Length } from 'class-validator';
import { RequirePermission } from '../auth/auth.decorators.js';
import { ClassSettingsDto, CreateAnnouncementDto } from './announcement.dto.js';
import { AnnouncementsService } from './announcements.service.js';

const id = new ParseUUIDPipe({ version: '7' });

class FeedQuery {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  cursor?: string;
}

@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  @RequirePermission({ announcement: ['read'] })
  feed(@Query() { cursor }: FeedQuery) {
    return this.announcements.feed(cursor);
  }

  @Get('scheduled')
  @RequirePermission({ announcement: ['read'] })
  scheduled() {
    return this.announcements.scheduled();
  }

  /** Who may post where is decided by the audience (see the service). */
  @Post()
  @RequirePermission({ announcement: ['read'] })
  create(@Body() dto: CreateAnnouncementDto) {
    return this.announcements.create(dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ announcement: ['read'] })
  remove(@Param('id', id) announcementId: string) {
    return this.announcements.remove(announcementId);
  }

  @Get('classes/:id/settings')
  @RequirePermission({ announcement: ['read'] })
  classSettings(@Param('id', id) classId: string) {
    return this.announcements.classSettings(classId);
  }

  @Put('classes/:id/settings')
  @RequirePermission({ announcement: ['post-class'] })
  saveClassSettings(
    @Param('id', id) classId: string,
    @Body() { assistantsCanPost }: ClassSettingsDto,
  ) {
    return this.announcements.saveClassSettings(classId, assistantsCanPost);
  }
}
