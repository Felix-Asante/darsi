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
import { CalendarRangeDto } from '../calendar/dto/calendar.dto.js';
import {
  BellPeriodDto,
  BellScheduleDto,
  TimetableSlotDto,
} from './dto/timetables.dto.js';
import { TimetablesService } from './timetables.service.js';

const id = new ParseUUIDPipe({ version: '7' });

@Controller('timetables')
export class TimetablesController {
  constructor(private readonly timetables: TimetablesService) {}

  @Get('me')
  @RequirePermission({ timetable: ['read'] })
  mine(@Query() { from, to }: CalendarRangeDto) {
    return this.timetables.mine(from, to);
  }

  @Get('students/:id')
  @RequirePermission({ timetable: ['read'] })
  forStudent(
    @Param('id', id) studentId: string,
    @Query() { from, to }: CalendarRangeDto,
  ) {
    return this.timetables.forStudent(studentId, from, to);
  }

  @Get('classes/:id')
  @RequirePermission({ timetable: ['read'] })
  forClass(
    @Param('id', id) classId: string,
    @Query() { from, to }: CalendarRangeDto,
  ) {
    return this.timetables.forClass(classId, from, to);
  }

  @Get('classes/:id/slots')
  @RequirePermission({ timetable: ['read'] })
  classSlots(@Param('id', id) classId: string) {
    return this.timetables.classTimetable(classId);
  }

  @Post('classes/:id/slots')
  @RequirePermission({ timetable: ['manage'] })
  createSlot(@Param('id', id) classId: string, @Body() dto: TimetableSlotDto) {
    return this.timetables.createSlot(classId, dto);
  }

  @Delete('classes/:id/slots/:slotId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ timetable: ['manage'] })
  deleteSlot(
    @Param('id', id) classId: string,
    @Param('slotId', id) slotId: string,
  ) {
    return this.timetables.deleteSlot(classId, slotId);
  }

  @Get('bell-schedules')
  @RequirePermission({ timetable: ['read'] })
  listSchedules() {
    return this.timetables.listSchedules();
  }

  @Post('bell-schedules')
  @RequirePermission({ timetable: ['manage'] })
  createSchedule(@Body() dto: BellScheduleDto) {
    return this.timetables.createSchedule(dto);
  }

  @Patch('bell-schedules/:id')
  @RequirePermission({ timetable: ['manage'] })
  updateSchedule(
    @Param('id', id) scheduleId: string,
    @Body() dto: BellScheduleDto,
  ) {
    return this.timetables.updateSchedule(scheduleId, dto);
  }

  @Delete('bell-schedules/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ timetable: ['manage'] })
  deleteSchedule(@Param('id', id) scheduleId: string) {
    return this.timetables.deleteSchedule(scheduleId);
  }

  @Post('bell-schedules/:id/periods')
  @RequirePermission({ timetable: ['manage'] })
  createPeriod(
    @Param('id', id) scheduleId: string,
    @Body() dto: BellPeriodDto,
  ) {
    return this.timetables.createPeriod(scheduleId, dto);
  }

  @Patch('periods/:id')
  @RequirePermission({ timetable: ['manage'] })
  updatePeriod(@Param('id', id) periodId: string, @Body() dto: BellPeriodDto) {
    return this.timetables.updatePeriod(periodId, dto);
  }

  @Delete('periods/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ timetable: ['manage'] })
  deletePeriod(@Param('id', id) periodId: string) {
    return this.timetables.deletePeriod(periodId);
  }
}
