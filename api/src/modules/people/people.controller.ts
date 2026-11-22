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
  Query,
} from '@nestjs/common';
import { RequirePermission } from '../auth/auth.decorators.js';
import {
  CreateGuardianDto,
  CreateStudentDto,
  EnrolStudentsDto,
  LinkGuardianDto,
  ListGuardiansQueryDto,
  ListStudentsQueryDto,
  UpdateFamilyDto,
  UpdateGuardianDto,
  UpdateStudentDto,
} from './dto/people.dto.js';
import { PeopleService } from './people.service.js';

const id = new ParseUUIDPipe({ version: '7' });

@Controller()
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  @Get('students')
  @RequirePermission({ people: ['read'] })
  listStudents(@Query() query: ListStudentsQueryDto) {
    return this.people.listStudents(query);
  }

  /** A guardian's children, or a signed-in student's own record. */
  @Get('students/mine')
  ownStudents() {
    return this.people.ownStudents();
  }

  /** Staff with directory access, or the student's own guardians, or the student. */
  @Get('students/:id')
  getStudent(@Param('id', id) studentId: string) {
    return this.people.getStudent(studentId);
  }

  @Post('students')
  @RequirePermission({ people: ['manage'] })
  async createStudent(@Body() dto: CreateStudentDto) {
    const student = await this.people.createStudent(dto);
    return this.people.getStudent(student.id);
  }

  @Patch('students/:id')
  @RequirePermission({ people: ['manage'] })
  async updateStudent(
    @Param('id', id) studentId: string,
    @Body() dto: UpdateStudentDto,
  ) {
    await this.people.updateStudent(studentId, dto);
    return this.people.getStudent(studentId);
  }

  @Post('students/:id/guardians')
  @RequirePermission({ people: ['manage'] })
  async linkGuardian(
    @Param('id', id) studentId: string,
    @Body() dto: LinkGuardianDto,
  ) {
    await this.people.linkGuardian(studentId, dto);
    return this.people.getStudent(studentId);
  }

  @Delete('students/:id/guardians/:guardianId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ people: ['manage'] })
  unlinkGuardian(
    @Param('id', id) studentId: string,
    @Param('guardianId', id) guardianId: string,
  ) {
    return this.people.unlinkGuardian(studentId, guardianId);
  }

  @Get('guardians')
  @RequirePermission({ people: ['read'] })
  listGuardians(@Query() query: ListGuardiansQueryDto) {
    return this.people.listGuardians(query);
  }

  @Get('guardians/:id')
  @RequirePermission({ people: ['read'] })
  getGuardian(@Param('id', id) guardianId: string) {
    return this.people.getGuardian(guardianId);
  }

  @Post('guardians')
  @RequirePermission({ people: ['manage'] })
  createGuardian(@Body() dto: CreateGuardianDto) {
    return this.people.createGuardian(dto);
  }

  @Patch('guardians/:id')
  @RequirePermission({ people: ['manage'] })
  updateGuardian(
    @Param('id', id) guardianId: string,
    @Body() dto: UpdateGuardianDto,
  ) {
    return this.people.updateGuardian(guardianId, dto);
  }

  @Get('families/:id')
  @RequirePermission({ people: ['read'] })
  getFamily(@Param('id', id) familyId: string) {
    return this.people.getFamily(familyId);
  }

  @Patch('families/:id')
  @RequirePermission({ people: ['manage'] })
  renameFamily(
    @Param('id', id) familyId: string,
    @Body() { name }: UpdateFamilyDto,
  ) {
    return this.people.renameFamily(familyId, name);
  }

  @Get('academics/classes/:id/students')
  @RequirePermission({ academics: ['read'] })
  roster(@Param('id', id) classId: string) {
    return this.people.roster(classId);
  }

  @Post('academics/classes/:id/students')
  @RequirePermission({ academics: ['manage'] })
  async enrol(@Param('id', id) classId: string, @Body() dto: EnrolStudentsDto) {
    await this.people.enrol(classId, dto);
    return this.people.roster(classId);
  }

  @Delete('academics/classes/:id/students/:studentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ academics: ['manage'] })
  unenrol(
    @Param('id', id) classId: string,
    @Param('studentId', id) studentId: string,
  ) {
    return this.people.unenrol(classId, studentId);
  }
}
