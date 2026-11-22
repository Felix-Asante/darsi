import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicsModule } from '../academics/academics.module.js';
import { SchoolsModule } from '../schools/schools.module.js';
import { AccountLinker } from './account-linker.js';
import { Enrolment } from './entities/enrolment.entity.js';
import { Family } from './entities/family.entity.js';
import { GuardianLink } from './entities/guardian-link.entity.js';
import { Guardian } from './entities/guardian.entity.js';
import { Student } from './entities/student.entity.js';
import { PeopleController } from './people.controller.js';
import { PeopleService } from './people.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Student,
      Guardian,
      Family,
      GuardianLink,
      Enrolment,
    ]),
    AcademicsModule,
    SchoolsModule,
  ],
  controllers: [PeopleController],
  providers: [PeopleService, AccountLinker],
  exports: [PeopleService],
})
export class PeopleModule {}
