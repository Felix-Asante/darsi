import { Body, Controller, Get, Headers, Patch, Post } from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';
import { RequirePermission } from '../auth/auth.decorators.js';
import {
  CompleteOnboardingDto,
  UpdateSchoolDto,
} from './dto/school-settings.dto.js';
import { SchoolsService } from './schools.service.js';

@Controller('schools/current')
export class SchoolsController {
  constructor(private readonly schools: SchoolsService) {}

  @Get()
  get() {
    return this.schools.getCurrent();
  }

  @Patch()
  @RequirePermission({ school: ['manage'] })
  update(
    @Body() dto: UpdateSchoolDto,
    @Headers() headers: IncomingHttpHeaders,
  ) {
    return this.schools.update(dto, headers);
  }

  @Post('onboarding')
  @RequirePermission({ school: ['manage'] })
  completeOnboarding(
    @Body() dto: CompleteOnboardingDto,
    @Headers() headers: IncomingHttpHeaders,
  ) {
    return this.schools.completeOnboarding(dto, headers);
  }
}
