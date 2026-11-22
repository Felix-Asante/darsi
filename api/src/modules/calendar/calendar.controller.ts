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
  Query,
} from '@nestjs/common';
import { RequirePermission } from '../auth/auth.decorators.js';
import { CalendarService } from './calendar.service.js';
import { CalendarEventDto, CalendarRangeDto } from './dto/calendar.dto.js';

const id = new ParseUUIDPipe({ version: '7' });

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get()
  @RequirePermission({ calendar: ['read'] })
  items(@Query() { from, to }: CalendarRangeDto) {
    return this.calendar.items(from, to);
  }

  @Get('events/:id')
  @RequirePermission({ calendar: ['manage'] })
  getEvent(@Param('id', id) eventId: string) {
    return this.calendar.getEvent(eventId);
  }

  @Post('events')
  @RequirePermission({ calendar: ['manage'] })
  createEvent(@Body() dto: CalendarEventDto) {
    return this.calendar.createEvent(dto);
  }

  @Patch('events/:id')
  @RequirePermission({ calendar: ['manage'] })
  updateEvent(@Param('id', id) eventId: string, @Body() dto: CalendarEventDto) {
    return this.calendar.updateEvent(eventId, dto);
  }

  @Delete('events/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ calendar: ['manage'] })
  deleteEvent(@Param('id', id) eventId: string) {
    return this.calendar.deleteEvent(eventId);
  }
}
