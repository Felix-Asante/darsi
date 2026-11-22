import {
  Body,
  Controller,
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
  GeneralCommentDto,
  OpenReportsDto,
  ReportTemplateDto,
  ReturnDto,
  SaveCommentsDto,
} from './report.dto.js';
import { ReportsService } from './reports.service.js';

const id = new ParseUUIDPipe({ version: '7' });

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('templates')
  @RequirePermission({ report: ['read'] })
  templates() {
    return this.reports.listTemplates();
  }

  @Put('templates')
  @RequirePermission({ report: ['manage'] })
  saveTemplate(@Body() dto: ReportTemplateDto) {
    return this.reports.saveTemplate(dto);
  }

  @Post('terms/:id/open')
  @HttpCode(HttpStatus.OK)
  @RequirePermission({ report: ['manage'] })
  open(@Param('id', id) termId: string, @Body() dto: OpenReportsDto) {
    return this.reports.open(termId, dto);
  }

  @Get('terms/:id/cards')
  @RequirePermission({ report: ['read'] })
  reviewList(@Param('id', id) termId: string) {
    return this.reports.reviewList(termId);
  }

  @Get('terms/:termId/classes/:classId')
  @RequirePermission({ report: ['comment'] })
  classSheet(
    @Param('classId', id) classId: string,
    @Param('termId', id) termId: string,
  ) {
    return this.reports.classSheet(classId, termId);
  }

  @Put('terms/:termId/classes/:classId')
  @RequirePermission({ report: ['comment'] })
  saveComments(
    @Param('classId', id) classId: string,
    @Param('termId', id) termId: string,
    @Body() { comments }: SaveCommentsDto,
  ) {
    return this.reports.saveComments(classId, termId, comments);
  }

  @Get('cards/:id')
  card(@Param('id', id) cardId: string) {
    return this.reports.card(cardId);
  }

  @Put('cards/:id/general-comment')
  @RequirePermission({ report: ['read'] })
  setGeneralComment(
    @Param('id', id) cardId: string,
    @Body() { generalComment }: GeneralCommentDto,
  ) {
    return this.reports.setGeneralComment(cardId, generalComment ?? null);
  }

  @Post('cards/:id/return')
  @HttpCode(HttpStatus.OK)
  @RequirePermission({ report: ['read'] })
  returnForEdits(@Param('id', id) cardId: string, @Body() { note }: ReturnDto) {
    return this.reports.returnForEdits(cardId, note);
  }

  @Post('cards/:id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermission({ report: ['read'] })
  approve(@Param('id', id) cardId: string) {
    return this.reports.approve(cardId);
  }
}
