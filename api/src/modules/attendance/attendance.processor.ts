import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  type AbsenceCheckJob,
  ATTENDANCE_QUEUE,
  AttendanceService,
} from './attendance.service.js';

@Processor(ATTENDANCE_QUEUE)
export class AttendanceProcessor extends WorkerHost {
  constructor(private readonly attendance: AttendanceService) {
    super();
  }

  process(job: Job<AbsenceCheckJob>) {
    return this.attendance.notifyUnexplained(job.data);
  }
}
