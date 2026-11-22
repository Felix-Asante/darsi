import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicsModule } from '../academics/academics.module.js';
import { CalendarModule } from '../calendar/calendar.module.js';
import { PeopleModule } from '../people/people.module.js';
import { BellPeriod } from './entities/bell-period.entity.js';
import { BellSchedule } from './entities/bell-schedule.entity.js';
import { TimetableSlot } from './entities/timetable-slot.entity.js';
import { TimetablesController } from './timetables.controller.js';
import { TimetablesService } from './timetables.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([BellSchedule, BellPeriod, TimetableSlot]),
    AcademicsModule,
    PeopleModule,
    CalendarModule,
  ],
  controllers: [TimetablesController],
  providers: [TimetablesService],
  exports: [TimetablesService],
})
export class TimetablesModule {}
