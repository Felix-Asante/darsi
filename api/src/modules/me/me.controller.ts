import { Controller, Get } from '@nestjs/common';
import { SchoolOptional } from '../auth/auth.decorators.js';
import { MeService } from './me.service.js';

@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get()
  @SchoolOptional()
  get() {
    return this.me.get();
  }
}
