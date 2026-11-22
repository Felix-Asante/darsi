import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurriculumController } from './curriculum.controller.js';
import { CurriculumService } from './curriculum.service.js';
import { Framework } from './entities/framework.entity.js';
import { Standard } from './entities/standard.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Framework, Standard])],
  controllers: [CurriculumController],
  providers: [CurriculumService],
  exports: [CurriculumService],
})
export class CurriculumModule {}
