import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicsModule } from '../academics/academics.module.js';
import { AssessmentModule } from '../assessment/assessment.module.js';
import { CurriculumModule } from '../curriculum/curriculum.module.js';
import { PlanningController } from './planning.controller.js';
import {
  Lesson,
  PlanTemplate,
  Unit,
  UnitAssessment,
  UnitClass,
  UnitCollaborator,
  UnitStandard,
} from './planning.entities.js';
import { PlanningService } from './planning.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlanTemplate,
      Unit,
      UnitClass,
      UnitStandard,
      UnitCollaborator,
      UnitAssessment,
      Lesson,
    ]),
    AcademicsModule,
    CurriculumModule,
    AssessmentModule,
  ],
  controllers: [PlanningController],
  providers: [PlanningService],
})
export class PlanningModule {}
