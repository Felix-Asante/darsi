import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicsModule } from '../academics/academics.module.js';
import { CalendarModule } from '../calendar/calendar.module.js';
import { PeopleModule } from '../people/people.module.js';
import { SchoolsModule } from '../schools/schools.module.js';
import { TimetablesModule } from '../timetables/timetables.module.js';
import { AttendanceController } from './attendance.controller.js';
import { ATTENDANCE_QUEUE, AttendanceService } from './attendance.service.js';
import {
  AbsenceNote,
  AttendanceRecord,
  AttendanceSession,
  AttendanceSettings,
  AttendanceStatus,
} from './entities/attendance.entities.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AttendanceSettings,
      AttendanceStatus,
      AttendanceSession,
      AttendanceRecord,
      AbsenceNote,
    ]),
    BullModule.registerQueue({ name: ATTENDANCE_QUEUE }),
    AcademicsModule,
    PeopleModule,
    CalendarModule,
    TimetablesModule,
    SchoolsModule,
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
