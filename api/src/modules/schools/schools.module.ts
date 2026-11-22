import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchoolClock } from './school-clock.service.js';
import { School } from './school.entity.js';
import { SchoolsController } from './schools.controller.js';
import { SchoolsService } from './schools.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([School])],
  controllers: [SchoolsController],
  providers: [SchoolsService, SchoolClock],
  exports: [SchoolsService, SchoolClock],
})
export class SchoolsModule {}
