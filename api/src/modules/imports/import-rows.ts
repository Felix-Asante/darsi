import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  type FieldError,
  ProblemException,
} from '../../common/errors/problem.exception.js';
import { AcademicsService } from '../academics/academics.service.js';
import { CurriculumService } from '../curriculum/curriculum.service.js';
import {
  CreateGuardianDto,
  CreateStudentDto,
} from '../people/dto/people.dto.js';
import {
  RELATIONSHIPS,
  type Relationship,
} from '../people/entities/guardian-link.entity.js';
import { PeopleService } from '../people/people.service.js';
import { TimetablesService } from '../timetables/timetables.service.js';
import { type CsvRow, optional, splitList } from './csv.js';
import type { ImportKind } from './entities/import-job.entity.js';

const toColumn = (field: string) =>
  field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

function rowError(code: string, field: string | null): ProblemException {
  return new ProblemException(
    HttpStatus.UNPROCESSABLE_ENTITY,
    code,
    undefined,
    field ? [{ field, codes: [code] }] : undefined,
  );
}

/** Validates a row with the same DTO the API uses, reporting errors by CSV column. */
async function validated<T extends object>(
  type: new () => T,
  values: Record<string, unknown>,
): Promise<T> {
  const dto = plainToInstance(type, values);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  if (errors.length > 0) {
    const fields: FieldError[] = errors.map((error) => ({
      field: toColumn(error.property),
      codes: Object.keys(error.constraints ?? {}),
    }));
    throw new ProblemException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'validation_failed',
      undefined,
      fields,
    );
  }
  return dto;
}

/** One handler per import kind. Each is idempotent: re-importing a row updates the same record. */
@Injectable()
export class ImportRows {
  constructor(
    private readonly academics: AcademicsService,
    private readonly people: PeopleService,
    private readonly curriculum: CurriculumService,
    private readonly timetables: TimetablesService,
  ) {}

  handle(kind: ImportKind, row: CsvRow): Promise<void> {
    switch (kind) {
      case 'students':
        return this.student(row);
      case 'guardians':
        return this.guardian(row);
      case 'classes':
        return this.schoolClass(row);
      case 'enrolments':
        return this.enrolment(row);
      case 'standards':
        return this.standard(row);
      case 'timetable':
        return this.timetableSlot(row);
    }
  }

  private async student(row: CsvRow) {
    const gradeLevelId = await this.gradeLevelId(row.grade_level);
    const dto = await validated(CreateStudentDto, {
      studentNumber: row.student_number,
      firstName: row.first_name,
      lastName: row.last_name,
      preferredName: optional(row.preferred_name),
      dateOfBirth: optional(row.date_of_birth),
      email: optional(row.email),
      gradeLevelId,
    });
    await this.people.upsertStudent(dto);
  }

  private async guardian(row: CsvRow) {
    const relationship = (optional(row.relationship)?.toLowerCase() ??
      'guardian') as Relationship;
    if (!RELATIONSHIPS.includes(relationship))
      throw rowError('isIn', 'relationship');
    const dto = await validated(CreateGuardianDto, {
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: optional(row.phone),
      preferredLocale: optional(row.preferred_locale)?.toLowerCase(),
    });

    const students = [];
    for (const studentNumber of splitList(row.student_numbers)) {
      const student = await this.people.findStudentByNumber(studentNumber);
      if (!student) throw rowError('studentNotFound', 'student_numbers');
      students.push(student);
    }

    const guardian = await this.people.upsertGuardian(dto);
    for (const student of students) {
      await this.people.linkGuardian(student.id, {
        guardianId: guardian.id,
        relationship,
      });
    }
  }

  private async schoolClass(row: CsvRow) {
    const year = await this.academics.requireCurrentYear();
    if (!row.code) throw rowError('isNotEmpty', 'code');
    if (!row.name) throw rowError('isNotEmpty', 'name');

    const subjectCode = optional(row.subject_code);
    const subject = subjectCode
      ? await this.academics.findSubjectByCode(subjectCode)
      : null;
    if (subjectCode && !subject)
      throw rowError('subjectNotFound', 'subject_code');
    const gradeLevelId = await this.gradeLevelId(row.grade_level);

    const teachers = splitList(row.teacher_emails);
    const assistants = splitList(row.assistant_emails);
    const members = await this.academics.membersByEmail([
      ...teachers,
      ...assistants,
    ]);
    for (const [column, emails] of [
      ['teacher_emails', teachers],
      ['assistant_emails', assistants],
    ] as const) {
      if (emails.some((email) => !members.has(email.toLowerCase())))
        throw rowError('notAMember', column);
    }

    const details = {
      name: row.name,
      subjectId: subject?.id ?? null,
      gradeLevelId: gradeLevelId ?? null,
    };
    const existing = await this.academics.findClassByCode(year.id, row.code);
    const classId = existing
      ? (await this.academics.updateClass(existing.id, details)).id
      : (
          await this.academics.createClass({
            academicYearId: year.id,
            code: row.code,
            ...details,
          })
        ).id;

    for (const email of teachers)
      await this.academics.addStaff(
        classId,
        members.get(email.toLowerCase())!,
        'teacher',
      );
    for (const email of assistants) {
      await this.academics.addStaff(
        classId,
        members.get(email.toLowerCase())!,
        'teaching_assistant',
      );
    }
  }

  private async enrolment(row: CsvRow) {
    const year = await this.academics.requireCurrentYear();
    const student = row.student_number
      ? await this.people.findStudentByNumber(row.student_number)
      : null;
    if (!student) throw rowError('studentNotFound', 'student_number');
    const schoolClass = row.class_code
      ? await this.academics.findClassByCode(year.id, row.class_code)
      : null;
    if (!schoolClass) throw rowError('classNotFound', 'class_code');
    await this.people.enrol(schoolClass.id, { studentIds: [student.id] });
  }

  private async standard(row: CsvRow) {
    if (!row.framework_code) throw rowError('isNotEmpty', 'framework_code');
    if (!row.code) throw rowError('isNotEmpty', 'code');
    if (!row.description) throw rowError('isNotEmpty', 'description');

    const framework =
      (await this.curriculum.findFrameworkByCode(row.framework_code)) ??
      (await this.curriculum.createFramework({
        code: row.framework_code,
        name: optional(row.framework_name) ?? row.framework_code,
      }));
    await this.curriculum.upsertStandard(
      framework.id,
      row.code,
      row.description,
      optional(row.parent_code) ?? null,
    );
  }

  private async timetableSlot(row: CsvRow) {
    const year = await this.academics.requireCurrentYear();
    const schoolClass = row.class_code
      ? await this.academics.findClassByCode(year.id, row.class_code)
      : null;
    if (!schoolClass) throw rowError('classNotFound', 'class_code');
    const day = Number(row.day);
    if (!Number.isInteger(day)) throw rowError('isInt', 'day');
    if (!row.period) throw rowError('isNotEmpty', 'period');
    const problem = await this.timetables.upsertSlot(
      schoolClass.id,
      row.period,
      day,
      optional(row.room) ?? null,
    );
    if (problem)
      throw rowError(problem, problem === 'periodNotFound' ? 'period' : 'day');
  }

  private async gradeLevelId(
    name: string | undefined,
  ): Promise<string | undefined> {
    if (!optional(name)) return undefined;
    const level = await this.academics.findGradeLevelByName(name!);
    if (!level) throw rowError('gradeLevelNotFound', 'grade_level');
    return level.id;
  }
}
