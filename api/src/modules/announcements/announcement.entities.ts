import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../common/entities/tenant.entity.js';
import type { RichTextNode } from '../../common/rich-text/rich-text.js';
import type { Role } from '../auth/access-control.js';

export const ANNOUNCEMENT_AUDIENCES = [
  'school',
  'division',
  'grade_level',
  'class',
  'role',
] as const;
export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

@Entity('announcements')
export class Announcement extends TenantEntity {
  @Column('text')
  title: string;

  /** Sanitised Tiptap JSON. */
  @Column('jsonb')
  body: RichTextNode;

  @Column('text')
  audience: AnnouncementAudience;

  @Column('uuid', { nullable: true })
  audienceId: string | null;

  @Column('text', { nullable: true })
  audienceRole: Role | null;

  @Column('uuid', { nullable: true })
  authorId: string | null;

  @Column('timestamptz')
  publishAt: Date;

  /** Null until sent; scheduled announcements are sent by the worker at `publishAt` (ANN-4). */
  @Column('timestamptz', { nullable: true })
  publishedAt: Date | null;
}

/** Whether a class's teaching assistants may post to it (ANN-1). */
@Entity('class_announcement_settings')
export class ClassAnnouncementSettings extends TenantEntity {
  @Column('uuid')
  classId: string;

  @Column('boolean')
  assistantsCanPost: boolean;
}
