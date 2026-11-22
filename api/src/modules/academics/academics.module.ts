import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicsController } from './academics.controller.js';
import { AcademicsService } from './academics.service.js';
import { AcademicYear } from './entities/academic-year.entity.js';
import { ClassStaff } from './entities/class-staff.entity.js';
import { Division } from './entities/division.entity.js';
import { GradeLevel } from './entities/grade-level.entity.js';
import { SchoolClass } from './entities/school-class.entity.js';
import { Subject } from './entities/subject.entity.js';
import { Term } from './entities/term.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AcademicYear,
      Division,
      GradeLevel,
      Subject,
      SchoolClass,
      ClassStaff,
      Term,
    ]),
  ],
  controllers: [AcademicsController],
  providers: [AcademicsService],
  exports: [AcademicsService],
})
export class AcademicsModule {}
