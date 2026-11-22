import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicsModule } from '../academics/academics.module.js';
import { CalendarModule } from '../calendar/calendar.module.js';
import { CurriculumModule } from '../curriculum/curriculum.module.js';
import { PeopleModule } from '../people/people.module.js';
import { SchoolsModule } from '../schools/schools.module.js';
import { AssessmentsController } from './assessments.controller.js';
import { AssessmentsService } from './assessments.service.js';
import { AssessmentCategory } from './entities/assessment-category.entity.js';
import { AssessmentCriterion } from './entities/assessment-criterion.entity.js';
import { AssessmentStandard } from './entities/assessment-standard.entity.js';
import { Assessment } from './entities/assessment.entity.js';
import { Grade } from './entities/grade.entity.js';
import { GradingPolicy } from './entities/grading-policy.entity.js';
import { GradingScaleVersion } from './entities/grading-scale-version.entity.js';
import { GradingScale } from './entities/grading-scale.entity.js';
import { ScaleConversion } from './entities/scale-conversion.entity.js';
import { Submission } from './entities/submission.entity.js';
import { GradingController } from './grading.controller.js';
import { GradingService } from './grading.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GradingScale,
      GradingScaleVersion,
      ScaleConversion,
      GradingPolicy,
      AssessmentCategory,
      Assessment,
      AssessmentCriterion,
      AssessmentStandard,
      Grade,
      Submission,
    ]),
    AcademicsModule,
    PeopleModule,
    CurriculumModule,
    CalendarModule,
    SchoolsModule,
  ],
  controllers: [GradingController, AssessmentsController],
  providers: [GradingService, AssessmentsService],
  exports: [GradingService, AssessmentsService],
})
export class AssessmentModule {}
