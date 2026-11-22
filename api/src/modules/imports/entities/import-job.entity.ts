import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';

export const IMPORT_KINDS = [
  'students',
  'guardians',
  'classes',
  'enrolments',
  'standards',
  'timetable',
] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];
export type ImportStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface ImportRowError {
  /** 1-based line in the file, counting the header as line 1. */
  row: number;
  field: string | null;
  code: string;
}

@Entity('import_jobs')
export class ImportJob extends TenantEntity {
  @Column('text')
  kind: ImportKind;

  @Column('text')
  status: ImportStatus;

  @Column('text')
  fileName: string;

  @Column('text', { select: false })
  content: string;

  @Column('integer')
  totalRows: number;

  @Column('integer')
  importedRows: number;

  @Column('integer')
  failedRows: number;

  @Column('jsonb')
  errors: ImportRowError[];

  @Column('uuid', { nullable: true })
  createdBy: string | null;

  @Column('timestamptz', { nullable: true })
  finishedAt: Date | null;
}
