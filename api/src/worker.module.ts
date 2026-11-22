import { Module } from '@nestjs/common';
import { CoreModule } from './core.module.js';
import { FEATURE_MODULES } from './feature-modules.js';
import { AnnouncementsWorkerModule } from './modules/announcements/announcements-worker.module.js';
import { AttendanceWorkerModule } from './modules/attendance/attendance-worker.module.js';
import { BillingWorkerModule } from './modules/billing/billing-worker.module.js';
import { FilesWorkerModule } from './modules/files/files-worker.module.js';
import { ReportsWorkerModule } from './modules/reports/reports-worker.module.js';
import { ImportsWorkerModule } from './modules/imports/imports-worker.module.js';

@Module({
  imports: [
    CoreModule.register({ relay: true }),
    ...FEATURE_MODULES,
    ImportsWorkerModule,
    AttendanceWorkerModule,
    AnnouncementsWorkerModule,
    FilesWorkerModule,
    ReportsWorkerModule,
    BillingWorkerModule,
  ],
})
export class WorkerModule {}
