import { Module } from '@nestjs/common';
import { FilesModule } from './files.module.js';
import { FilesProcessor } from './files.processor.js';

/** Registered in the worker only: malware scans run there (DRV-8). */
@Module({
  imports: [FilesModule],
  providers: [FilesProcessor],
})
export class FilesWorkerModule {}
