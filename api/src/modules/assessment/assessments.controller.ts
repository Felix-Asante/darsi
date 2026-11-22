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
import { AssessmentsService } from './assessments.service.js';
import {
  CreateAssessmentDto,
  SaveGradesDto,
  SubmissionDto,
  TermQueryDto,
  UpdateAssessmentDto,
} from './dto/assessment.dto.js';

const id = new ParseUUIDPipe({ version: '7' });

@Controller('assessment')
export class AssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}

  @Get('classes/:id/assessments')
  @RequirePermission({ assessment: ['read'] })
  listForClass(@Param('id', id) classId: string) {
    return this.assessments.listForClass(classId);
  }

  @Post('classes/:id/assessments')
  @RequirePermission({ assessment: ['create'] })
  create(@Param('id', id) classId: string, @Body() dto: CreateAssessmentDto) {
    return this.assessments.create(classId, dto);
  }

  @Get('classes/:id/gradebook')
  @RequirePermission({ assessment: ['grade'] })
  gradebook(
    @Param('id', id) classId: string,
    @Query() { termId }: TermQueryDto,
  ) {
    return this.assessments.gradebook(classId, termId);
  }

  @Get('students/:id/grades')
  @RequirePermission({ assessment: ['read'] })
  studentGrades(
    @Param('id', id) studentId: string,
    @Query() { termId }: TermQueryDto,
  ) {
    return this.assessments.studentGrades(studentId, termId);
  }

  @Get('assessments/:id')
  @RequirePermission({ assessment: ['read'] })
  get(@Param('id', id) assessmentId: string) {
    return this.assessments.get(assessmentId);
  }

  @Patch('assessments/:id')
  @RequirePermission({ assessment: ['create'] })
  update(
    @Param('id', id) assessmentId: string,
    @Body() dto: UpdateAssessmentDto,
  ) {
    return this.assessments.update(assessmentId, dto);
  }

  @Delete('assessments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ assessment: ['create'] })
  remove(@Param('id', id) assessmentId: string) {
    return this.assessments.remove(assessmentId);
  }

  @Get('assessments/:id/grades')
  @RequirePermission({ assessment: ['grade'] })
  sheet(@Param('id', id) assessmentId: string) {
    return this.assessments.sheet(assessmentId);
  }

  @Put('assessments/:id/grades')
  @RequirePermission({ assessment: ['grade'] })
  saveGrades(
    @Param('id', id) assessmentId: string,
    @Body() dto: SaveGradesDto,
  ) {
    return this.assessments.saveGrades(assessmentId, dto);
  }

  @Post('assessments/:id/publish')
  @HttpCode(HttpStatus.OK)
  @RequirePermission({ assessment: ['publish'] })
  publishAll(@Param('id', id) assessmentId: string) {
    return this.assessments.publishAll(assessmentId);
  }

  /** The signed-in student hands in their work. */
  @Put('assessments/:id/submission')
  @RequirePermission({ assessment: ['read'] })
  submit(
    @Param('id', id) assessmentId: string,
    @Body() { body }: SubmissionDto,
  ) {
    return this.assessments.submit(assessmentId, { body });
  }
}
