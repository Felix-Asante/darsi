import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../../common/entities/tenant.entity.js';

const bigintAsNumber = {
  to: (value: number) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

export type FileStatus = 'pending' | 'scanning' | 'available' | 'rejected';
export type FilePurpose =
  'drive' | 'student' | 'submission' | 'portfolio' | 'application';

/** An uploaded object. It is only served once the malware scan has passed (DRV-8). */
@Entity('files')
export class StoredFile extends TenantEntity {
  @Column('text')
  name: string;

  @Column('text')
  contentType: string;

  @Column('bigint', { transformer: bigintAsNumber })
  sizeBytes: number;

  @Column('text')
  status: FileStatus;

  @Column('text')
  purpose: FilePurpose;

  /** `quarantine/…` until scanned, then `clean/…`. Never derived from the file's name. */
  @Column('text')
  storageKey: string;

  @Column('uuid', { nullable: true })
  uploadedBy: string | null;

  @Column('timestamptz', { nullable: true })
  scannedAt: Date | null;
}

export const FILE_PII_FIELDS = ['name'] as const;

@Entity('file_quotas')
export class FileQuota extends TenantEntity {
  @Column('bigint', { transformer: bigintAsNumber })
  quotaBytes: number;
}

export const DRIVE_AUDIENCES = ['class_member', 'student', 'guardian'] as const;
export type DriveAudience = (typeof DRIVE_AUDIENCES)[number];

/** A folder or file in a class drive. Staff always see everything; `visibility` adds others (DRV-3). */
@Entity('drive_items')
export class DriveItem extends TenantEntity {
  @Column('uuid')
  classId: string;

  @Column('uuid', { nullable: true })
  parentId: string | null;

  @Column('text')
  kind: 'folder' | 'file';

  @Column('text')
  name: string;

  @Column('uuid', { nullable: true })
  fileId: string | null;

  @Column('text', { array: true })
  visibility: DriveAudience[];

  @Column('uuid', { nullable: true })
  createdBy: string | null;

  @Column('uuid', { nullable: true })
  updatedBy: string | null;
}

/** Official documents on a student's record (RPT-7). */
@Entity('student_files')
export class StudentFile extends TenantEntity {
  @Column('uuid')
  studentId: string;

  @Column('uuid')
  fileId: string;

  @Column('text')
  title: string;

  @Column('boolean')
  visibleToFamily: boolean;
}

export const ATTACHMENT_TARGETS = [
  'lesson',
  'assessment',
  'announcement',
] as const;
export type AttachmentTarget = (typeof ATTACHMENT_TARGETS)[number];

/** A drive file attached by reference, never copied (DRV-10). */
@Entity('attachment_links')
export class AttachmentLink extends TenantEntity {
  @Column('uuid')
  driveItemId: string;

  @Column('text')
  targetType: AttachmentTarget;

  @Column('uuid')
  targetId: string;
}
