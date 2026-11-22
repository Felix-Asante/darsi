import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  type EnvironmentVariables,
  MalwareScannerKind,
} from '../../config/env.validation.js';
import { AcademicsModule } from '../academics/academics.module.js';
import { AssessmentModule } from '../assessment/assessment.module.js';
import { PeopleModule } from '../people/people.module.js';
import { DriveAccessService } from './drive-access.service.js';
import { DriveService } from './drive.service.js';
import {
  AttachmentLink,
  DriveItem,
  FileQuota,
  StoredFile,
  StudentFile,
} from './entities/files.entities.js';
import { FilesController } from './files.controller.js';
import { FILES_QUEUE, FilesService } from './files.service.js';
import { ObjectStorage } from './object-storage.service.js';
import { ClamdScanner } from './scanning/clamd.scanner.js';
import { MalwareScanner } from './scanning/malware-scanner.js';
import { TestSignatureScanner } from './scanning/test-signature.scanner.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StoredFile,
      FileQuota,
      DriveItem,
      StudentFile,
      AttachmentLink,
    ]),
    BullModule.registerQueue({ name: FILES_QUEUE }),
    AcademicsModule,
    PeopleModule,
    AssessmentModule,
  ],
  controllers: [FilesController],
  providers: [
    ObjectStorage,
    DriveAccessService,
    FilesService,
    DriveService,
    {
      provide: MalwareScanner,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
        config.get('MALWARE_SCANNER', { infer: true }) ===
        MalwareScannerKind.Test
          ? new TestSignatureScanner()
          : new ClamdScanner(
              config.get('CLAMAV_HOST', { infer: true }),
              config.get('CLAMAV_PORT', { infer: true }),
            ),
    },
  ],
  exports: [FilesService, DriveService, ObjectStorage],
})
export class FilesModule {}
