import { Module } from '@nestjs/common';
import { SchoolsModule } from '../schools/schools.module.js';
import { MeController } from './me.controller.js';
import { MeService } from './me.service.js';

@Module({
  imports: [SchoolsModule],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
