import { Module } from '@nestjs/common';
import { AttendanceProcessor } from './attendance.processor.js';
import { AttendanceModule } from './attendance.module.js';

/** Registered in the worker only: absence notices go out after the school's delay. */
@Module({
  imports: [AttendanceModule],
  providers: [AttendanceProcessor],
})
export class AttendanceWorkerModule {}
