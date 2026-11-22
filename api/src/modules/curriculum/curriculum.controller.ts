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
} from '@nestjs/common';
import { RequirePermission } from '../auth/auth.decorators.js';
import { CurriculumService } from './curriculum.service.js';
import { FrameworkDto, StandardDto } from './dto/curriculum.dto.js';

const id = new ParseUUIDPipe({ version: '7' });

@Controller('curriculum')
export class CurriculumController {
  constructor(private readonly curriculum: CurriculumService) {}

  @Get('frameworks')
  @RequirePermission({ academics: ['read'] })
  listFrameworks() {
    return this.curriculum.listFrameworks();
  }

  @Post('frameworks')
  @RequirePermission({ academics: ['manage'] })
  createFramework(@Body() dto: FrameworkDto) {
    return this.curriculum.createFramework(dto);
  }

  @Patch('frameworks/:id')
  @RequirePermission({ academics: ['manage'] })
  updateFramework(
    @Param('id', id) frameworkId: string,
    @Body() dto: FrameworkDto,
  ) {
    return this.curriculum.updateFramework(frameworkId, dto);
  }

  @Get('frameworks/:id/standards')
  @RequirePermission({ academics: ['read'] })
  standards(@Param('id', id) frameworkId: string) {
    return this.curriculum.standardsTree(frameworkId);
  }

  @Post('frameworks/:id/standards')
  @RequirePermission({ academics: ['manage'] })
  createStandard(
    @Param('id', id) frameworkId: string,
    @Body() dto: StandardDto,
  ) {
    return this.curriculum.createStandard(frameworkId, dto);
  }

  @Patch('standards/:id')
  @RequirePermission({ academics: ['manage'] })
  updateStandard(
    @Param('id', id) standardId: string,
    @Body() dto: StandardDto,
  ) {
    return this.curriculum.updateStandard(standardId, dto);
  }

  @Delete('standards/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ academics: ['manage'] })
  deleteStandard(@Param('id', id) standardId: string) {
    return this.curriculum.deleteStandard(standardId);
  }
}
