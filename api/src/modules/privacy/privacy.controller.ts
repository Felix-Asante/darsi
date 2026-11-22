import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { RequirePermission } from '../auth/auth.decorators.js';
import { PrivacyService } from './privacy.service.js';

const id = new ParseUUIDPipe({ version: '7' });

/** Data subject requests, handled by the school's administrators. */
@Controller('privacy/students')
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get(':id/export')
  @RequirePermission({ people: ['manage'] })
  export(@Param('id', id) studentId: string) {
    return this.privacy.export(studentId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ people: ['manage'] })
  erase(@Param('id', id) studentId: string) {
    return this.privacy.erase(studentId);
  }
}
