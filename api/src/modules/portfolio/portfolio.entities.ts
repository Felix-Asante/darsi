import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../common/entities/tenant.entity.js';
import type { RichTextNode } from '../../common/rich-text/rich-text.js';

/** Whether items added by students and assistants wait for a teacher before families see them (PRT-4). */
@Entity('portfolio_settings')
export class PortfolioSettings extends TenantEntity {
  @Column('boolean')
  approvalRequired: boolean;
}

export const ITEM_KINDS = ['image', 'document', 'link', 'text'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

/** A piece of work in a student's portfolio, or in a class portfolio when `studentId` is null (PRT-2/5). */
@Entity('portfolio_items')
export class PortfolioItem extends TenantEntity {
  @Column('uuid', { nullable: true })
  studentId: string | null;

  /** The class portfolio it belongs to, or the class a student's item relates to. */
  @Column('uuid', { nullable: true })
  classId: string | null;

  @Column('text')
  kind: ItemKind;

  @Column('text')
  title: string;

  @Column('text', { nullable: true })
  description: string | null;

  @Column('text', { nullable: true })
  url: string | null;

  @Column('jsonb', { nullable: true })
  body: RichTextNode | null;

  @Column('uuid', { nullable: true })
  fileId: string | null;

  @Column('text', { array: true })
  tags: string[];

  @Column('uuid', { nullable: true })
  addedBy: string | null;

  @Column('text')
  status: 'pending' | 'approved';

  @Column('uuid', { nullable: true })
  approvedBy: string | null;
}

@Entity('portfolio_comments')
export class PortfolioComment extends TenantEntity {
  @Column('uuid')
  itemId: string;

  @Column('uuid', { nullable: true })
  authorId: string | null;

  /** Teachers comment; students reflect on their own work (PRT-3). */
  @Column('text')
  kind: 'comment' | 'reflection';

  @Column('text')
  body: string;
}

export const PORTFOLIO_PII_FIELDS = ['title', 'description', 'body'] as const;
