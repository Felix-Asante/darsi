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
  ConversionDto,
  ConvertPreviewDto,
  CreateScaleDto,
  PolicyDto,
  UpdateScaleDto,
} from './dto/grading.dto.js';
import { GradingService } from './grading.service.js';

const id = new ParseUUIDPipe({ version: '7' });

@Controller('grading')
export class GradingController {
  constructor(private readonly grading: GradingService) {}

  @Get('presets')
  @RequirePermission({ gradingScale: ['read'] })
  presets() {
    return this.grading.presets();
  }

  @Get('scales')
  @RequirePermission({ gradingScale: ['read'] })
  listScales() {
    return this.grading.listScales();
  }

  @Post('scales')
  @RequirePermission({ gradingScale: ['manage'] })
  createScale(@Body() dto: CreateScaleDto) {
    return this.grading.createScale(dto);
  }

  @Put('scales/:id')
  @RequirePermission({ gradingScale: ['manage'] })
  updateScale(@Param('id', id) scaleId: string, @Body() dto: UpdateScaleDto) {
    return this.grading.updateScale(scaleId, dto);
  }

  @Get('conversions')
  @RequirePermission({ gradingScale: ['read'] })
  listConversions() {
    return this.grading.listConversions();
  }

  @Put('conversions')
  @RequirePermission({ gradingScale: ['manage'] })
  saveConversion(@Body() dto: ConversionDto) {
    return this.grading.saveConversion(dto);
  }

  @Post('convert')
  @HttpCode(HttpStatus.OK)
  @RequirePermission({ gradingScale: ['read'] })
  preview(@Body() { fromScaleId, toScaleId, value }: ConvertPreviewDto) {
    return this.grading.preview(fromScaleId, toScaleId, value);
  }

  @Get('policies')
  @RequirePermission({ gradingScale: ['read'] })
  listPolicies() {
    return this.grading.listPolicies();
  }

  @Put('policies')
  @RequirePermission({ gradingScale: ['manage'] })
  savePolicy(@Body() dto: PolicyDto) {
    return this.grading.savePolicy(dto);
  }
}
