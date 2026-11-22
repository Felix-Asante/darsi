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
  Query,
} from '@nestjs/common';
import { RequirePermission } from '../auth/auth.decorators.js';
import {
  ItemsQueryDto,
  PortfolioCommentDto,
  PortfolioItemDto,
  PortfolioSettingsDto,
} from './portfolio.dto.js';
import { PortfolioService } from './portfolio.service.js';

const id = new ParseUUIDPipe({ version: '7' });

/** Who sees and adds what depends on the student or class, so the service checks it. */
@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get('students/:id')
  @RequirePermission({ portfolio: ['read'] })
  overview(@Param('id', id) studentId: string) {
    return this.portfolio.overview(studentId);
  }

  @Get('students/:id/items')
  @RequirePermission({ portfolio: ['read'] })
  items(
    @Param('id', id) studentId: string,
    @Query() { cursor }: ItemsQueryDto,
  ) {
    return this.portfolio.items(studentId, cursor);
  }

  @Get('classes/:id/items')
  @RequirePermission({ portfolio: ['read'] })
  classItems(
    @Param('id', id) classId: string,
    @Query() { cursor }: ItemsQueryDto,
  ) {
    return this.portfolio.classItems(classId, cursor);
  }

  @Post('items')
  @RequirePermission({ portfolio: ['write'] })
  add(@Body() dto: PortfolioItemDto) {
    return this.portfolio.add(dto);
  }

  @Post('items/:id/approve')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ portfolio: ['approve'] })
  approve(@Param('id', id) itemId: string) {
    return this.portfolio.approve(itemId);
  }

  @Delete('items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ portfolio: ['write'] })
  remove(@Param('id', id) itemId: string) {
    return this.portfolio.remove(itemId);
  }

  @Post('items/:id/comments')
  @RequirePermission({ portfolio: ['read'] })
  comment(
    @Param('id', id) itemId: string,
    @Body() { body }: PortfolioCommentDto,
  ) {
    return this.portfolio.comment(itemId, body);
  }

  @Get('settings')
  @RequirePermission({ portfolio: ['read'] })
  settings() {
    return this.portfolio.settings();
  }

  @Put('settings')
  @RequirePermission({ school: ['manage'] })
  saveSettings(@Body() { approvalRequired }: PortfolioSettingsDto) {
    return this.portfolio.saveSettings(approvalRequired);
  }
}
