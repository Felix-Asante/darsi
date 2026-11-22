import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { RequirePermission } from '../auth/auth.decorators.js';
import { AttendanceService } from './attendance.service.js';
import {
  AbsenceReasonDto,
  AttendanceSettingsDto,
  AttendanceStatusDto,
  RangeDto,
  ReportQueryDto,
  SessionQueryDto,
  TakeAttendanceDto,
} from './dto/attendance.dto.js';

const id = new ParseUUIDPipe({ version: '7' });

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get('settings')
  @RequirePermission({ attendance: ['read'] })
  settings() {
    return this.attendance.settings();
  }

  @Put('settings')
  @RequirePermission({ school: ['manage'] })
  saveSettings(@Body() dto: AttendanceSettingsDto) {
    return this.attendance.saveSettings(dto);
  }

  @Get('statuses')
  @RequirePermission({ attendance: ['read'] })
  statuses() {
    return this.attendance.statuses();
  }

  @Post('statuses')
  @RequirePermission({ school: ['manage'] })
  createStatus(@Body() dto: AttendanceStatusDto) {
    return this.attendance.createStatus(dto);
  }

  @Delete('statuses/:code')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ school: ['manage'] })
  deleteStatus(@Param('code') code: string) {
    return this.attendance.deleteStatus(code);
  }

  @Get('classes/:id')
  @RequirePermission({ attendance: ['take'] })
  session(
    @Param('id', id) classId: string,
    @Query() { date, periodId }: SessionQueryDto,
  ) {
    return this.attendance.session(classId, date, periodId);
  }

  @Put('classes/:id')
  @RequirePermission({ attendance: ['take'] })
  take(@Param('id', id) classId: string, @Body() dto: TakeAttendanceDto) {
    return this.attendance.take(classId, dto);
  }

  @Get('students/:id/summary')
  @RequirePermission({ attendance: ['read'] })
  summary(@Param('id', id) studentId: string, @Query() { from, to }: RangeDto) {
    return this.attendance.studentSummary(studentId, from, to);
  }

  /** Guardians explain an absence; staff can record a reason the same way. */
  @Post('students/:id/reasons')
  explain(
    @Param('id', id) studentId: string,
    @Body() { date, reason }: AbsenceReasonDto,
  ) {
    return this.attendance.explain(studentId, date, reason);
  }

  @Get('report')
  @RequirePermission({ attendance: ['read'] })
  report(@Query() query: ReportQueryDto) {
    return this.attendance.report(query);
  }

  @Get('report.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="attendance.csv"')
  @RequirePermission({ attendance: ['read'] })
  reportCsv(@Query() query: ReportQueryDto) {
    return this.attendance.reportCsv(query);
  }
}
