import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { RequirePermission } from '../auth/auth.decorators.js';
import {
  CollaboratorsDto,
  CopyUnitDto,
  LessonDto,
  LinkAssessmentsDto,
  TemplateDto,
  UnitDto,
} from './planning.dto.js';
import { PlanningService } from './planning.service.js';

const id = new ParseUUIDPipe({ version: '7' });

@Controller('planning')
export class PlanningController {
  constructor(private readonly planning: PlanningService) {}

  @Get('templates')
  @RequirePermission({ plan: ['read'] })
  listTemplates() {
    return this.planning.listTemplates();
  }

  @Post('templates')
  @RequirePermission({ academics: ['manage'] })
  createTemplate(@Body() dto: TemplateDto) {
    return this.planning.saveTemplate(dto);
  }

  @Put('templates/:id')
  @RequirePermission({ academics: ['manage'] })
  updateTemplate(
    @Param('id', id) templateId: string,
    @Body() dto: TemplateDto,
  ) {
    return this.planning.saveTemplate(dto, templateId);
  }

  @Get('units')
  @RequirePermission({ plan: ['read'] })
  mine() {
    return this.planning.mine();
  }

  @Get('classes/:id/units')
  @RequirePermission({ plan: ['read'] })
  forClass(@Param('id', id) classId: string) {
    return this.planning.listForClass(classId);
  }

  @Post('units')
  @RequirePermission({ plan: ['write'] })
  create(@Body() dto: UnitDto) {
    return this.planning.create(dto);
  }

  @Get('units/:id')
  @RequirePermission({ plan: ['read'] })
  get(@Param('id', id) unitId: string) {
    return this.planning.get(unitId);
  }

  /** Editors without `plan:write` (assistants invited as editors) can change the units shared with them. */
  @Put('units/:id')
  @RequirePermission({ plan: ['read'] })
  update(@Param('id', id) unitId: string, @Body() dto: UnitDto) {
    return this.planning.update(unitId, dto);
  }

  @Delete('units/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ plan: ['write'] })
  remove(@Param('id', id) unitId: string) {
    return this.planning.remove(unitId);
  }

  @Put('units/:id/collaborators')
  @RequirePermission({ plan: ['write'] })
  setCollaborators(
    @Param('id', id) unitId: string,
    @Body() { collaborators }: CollaboratorsDto,
  ) {
    return this.planning.setCollaborators(unitId, collaborators);
  }

  @Put('units/:id/assessments')
  @RequirePermission({ plan: ['read'] })
  linkAssessments(
    @Param('id', id) unitId: string,
    @Body() { assessmentIds }: LinkAssessmentsDto,
  ) {
    return this.planning.linkAssessments(unitId, assessmentIds);
  }

  @Post('units/:id/copy')
  @RequirePermission({ plan: ['write'] })
  copy(@Param('id', id) unitId: string, @Body() dto: CopyUnitDto) {
    return this.planning.copy(unitId, dto);
  }

  @Post('units/:id/lessons')
  @RequirePermission({ plan: ['read'] })
  createLesson(@Param('id', id) unitId: string, @Body() dto: LessonDto) {
    return this.planning.saveLesson(unitId, dto);
  }

  @Put('units/:id/lessons/:lessonId')
  @RequirePermission({ plan: ['read'] })
  updateLesson(
    @Param('id', id) unitId: string,
    @Param('lessonId', id) lessonId: string,
    @Body() dto: LessonDto,
  ) {
    return this.planning.saveLesson(unitId, dto, lessonId);
  }

  @Delete('units/:id/lessons/:lessonId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ plan: ['read'] })
  removeLesson(
    @Param('id', id) unitId: string,
    @Param('lessonId', id) lessonId: string,
  ) {
    return this.planning.removeLesson(unitId, lessonId);
  }
}
