import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsUUID,
} from 'class-validator';
import {
  NOTIFICATION_TYPES,
  type NotificationType,
} from './notification-preference.entity.js';
import { CursorQueryDto } from '../../common/pagination/cursor-pagination.js';
import { NotificationsService } from './notifications.service.js';

class MarkReadDto {
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID(7, { each: true })
  ids: string[];
}

class PreferenceDto {
  @IsIn(NOTIFICATION_TYPES)
  type: NotificationType;

  @IsBoolean()
  inApp: boolean;

  @IsBoolean()
  email: boolean;
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Query() query: CursorQueryDto) {
    return this.notifications.list(query);
  }

  @Get('preferences')
  preferences() {
    return this.notifications.preferences();
  }

  @Put('preferences')
  @HttpCode(HttpStatus.NO_CONTENT)
  savePreference(@Body() { type, inApp, email }: PreferenceDto) {
    return this.notifications.savePreference(type, inApp, email);
  }

  @Get('unread-count')
  unreadCount() {
    return this.notifications.unreadCount();
  }

  @Post('read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(@Body() { ids }: MarkReadDto) {
    return this.notifications.markRead(ids);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAllRead() {
    return this.notifications.markAllRead();
  }
}
