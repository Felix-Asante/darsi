import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { RequirePermission } from '../auth/auth.decorators.js';
import { CreateImportDto } from './dto/create-import.dto.js';
import { IMPORT_COLUMNS } from './import-columns.js';
import { ImportsService } from './imports.service.js';

@Controller('imports')
@RequirePermission({ people: ['manage'], academics: ['manage'] })
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Get('columns')
  columns() {
    return IMPORT_COLUMNS;
  }

  @Get()
  list() {
    return this.imports.list();
  }

  @Post()
  create(@Body() dto: CreateImportDto) {
    return this.imports.create(dto);
  }

  @Get(':id')
  get(@Param('id', new ParseUUIDPipe({ version: '7' })) id: string) {
    return this.imports.get(id);
  }
}
