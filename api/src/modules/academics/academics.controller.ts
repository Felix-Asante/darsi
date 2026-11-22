import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { RequirePermission } from '../auth/auth.decorators.js';
import { AcademicsService } from './academics.service.js';
import {
  CreateAcademicYearDto,
  CreateClassDto,
  DivisionDto,
  GradeLevelDto,
  ListClassesQueryDto,
  SetClassStaffDto,
  SubjectDto,
  TermDto,
  UpdateAcademicYearDto,
  UpdateClassDto,
} from './dto/academics.dto.js';

const id = new ParseUUIDPipe({ version: '7' });

@Controller('academics')
export class AcademicsController {
  constructor(private readonly academics: AcademicsService) {}

  @Get('years')
  @RequirePermission({ academics: ['read'] })
  listYears() {
    return this.academics.listYears();
  }

  @Post('years')
  @RequirePermission({ academics: ['manage'] })
  createYear(@Body() dto: CreateAcademicYearDto) {
    return this.academics.createYear(dto);
  }

  @Patch('years/:id')
  @RequirePermission({ academics: ['manage'] })
  updateYear(
    @Param('id', id) yearId: string,
    @Body() dto: UpdateAcademicYearDto,
  ) {
    return this.academics.updateYear(yearId, dto);
  }

  @Post('years/:id/make-current')
  @HttpCode(HttpStatus.OK)
  @RequirePermission({ academics: ['manage'] })
  makeCurrent(@Param('id', id) yearId: string) {
    return this.academics.makeCurrent(yearId);
  }

  @Get('years/:id/terms')
  @RequirePermission({ academics: ['read'] })
  listTerms(@Param('id', id) yearId: string) {
    return this.academics.listTerms(yearId);
  }

  @Post('years/:id/terms')
  @RequirePermission({ academics: ['manage'] })
  createTerm(@Param('id', id) yearId: string, @Body() dto: TermDto) {
    return this.academics.createTerm(yearId, dto);
  }

  @Patch('terms/:id')
  @RequirePermission({ academics: ['manage'] })
  updateTerm(@Param('id', id) termId: string, @Body() dto: TermDto) {
    return this.academics.updateTerm(termId, dto);
  }

  @Delete('terms/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ academics: ['manage'] })
  deleteTerm(@Param('id', id) termId: string) {
    return this.academics.deleteTerm(termId);
  }

  @Get('divisions')
  @RequirePermission({ academics: ['read'] })
  listDivisions() {
    return this.academics.listDivisions();
  }

  @Post('divisions')
  @RequirePermission({ academics: ['manage'] })
  createDivision(@Body() dto: DivisionDto) {
    return this.academics.createDivision(dto);
  }

  @Patch('divisions/:id')
  @RequirePermission({ academics: ['manage'] })
  updateDivision(
    @Param('id', id) divisionId: string,
    @Body() dto: DivisionDto,
  ) {
    return this.academics.updateDivision(divisionId, dto);
  }

  @Delete('divisions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ academics: ['manage'] })
  deleteDivision(@Param('id', id) divisionId: string) {
    return this.academics.deleteDivision(divisionId);
  }

  @Post('grade-levels')
  @RequirePermission({ academics: ['manage'] })
  createGradeLevel(@Body() dto: GradeLevelDto) {
    return this.academics.createGradeLevel(dto);
  }

  @Patch('grade-levels/:id')
  @RequirePermission({ academics: ['manage'] })
  updateGradeLevel(
    @Param('id', id) levelId: string,
    @Body() dto: GradeLevelDto,
  ) {
    return this.academics.updateGradeLevel(levelId, dto);
  }

  @Delete('grade-levels/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ academics: ['manage'] })
  deleteGradeLevel(@Param('id', id) levelId: string) {
    return this.academics.deleteGradeLevel(levelId);
  }

  @Get('subjects')
  @RequirePermission({ academics: ['read'] })
  listSubjects() {
    return this.academics.listSubjects();
  }

  @Post('subjects')
  @RequirePermission({ academics: ['manage'] })
  createSubject(@Body() dto: SubjectDto) {
    return this.academics.createSubject(dto);
  }

  @Patch('subjects/:id')
  @RequirePermission({ academics: ['manage'] })
  updateSubject(@Param('id', id) subjectId: string, @Body() dto: SubjectDto) {
    return this.academics.updateSubject(subjectId, dto);
  }

  @Get('classes')
  @RequirePermission({ academics: ['read'] })
  listClasses(@Query() query: ListClassesQueryDto) {
    return this.academics.listClasses(query);
  }

  @Post('classes')
  @RequirePermission({ academics: ['manage'] })
  createClass(@Body() dto: CreateClassDto) {
    return this.academics.createClass(dto);
  }

  @Get('classes/:id')
  @RequirePermission({ academics: ['read'] })
  getClass(@Param('id', id) classId: string) {
    return this.academics.getClass(classId);
  }

  @Patch('classes/:id')
  @RequirePermission({ academics: ['manage'] })
  updateClass(@Param('id', id) classId: string, @Body() dto: UpdateClassDto) {
    return this.academics.updateClass(classId, dto);
  }

  @Put('classes/:id/staff')
  @RequirePermission({ academics: ['manage'] })
  setStaff(@Param('id', id) classId: string, @Body() dto: SetClassStaffDto) {
    return this.academics.setStaff(classId, dto);
  }
}
