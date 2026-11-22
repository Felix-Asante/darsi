import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../common/entities/tenant.entity.js';
import type { RichTextNode } from '../../common/rich-text/rich-text.js';

export interface TemplateField {
  key: string;
  label: string;
  kind: 'text' | 'richtext';
}

/** A school's planning format, such as an IB MYP unit planner (PLN-1). */
@Entity('plan_templates')
export class PlanTemplate extends TenantEntity {
  @Column('text')
  name: string;

  @Column('uuid', { nullable: true })
  frameworkId: string | null;

  @Column('jsonb')
  fields: TemplateField[];
}

@Entity('units')
export class Unit extends TenantEntity {
  @Column('uuid', { nullable: true })
  templateId: string | null;

  @Column('text')
  title: string;

  @Column('date', { nullable: true })
  startsOn: string | null;

  @Column('date', { nullable: true })
  endsOn: string | null;

  @Column('jsonb', { nullable: true })
  objectives: RichTextNode | null;

  /** Template field key → text, or rich text for `richtext` fields. */
  @Column('jsonb')
  fieldValues: Record<string, string | RichTextNode>;

  @Column('uuid', { nullable: true })
  createdBy: string | null;

  @Column('uuid', { nullable: true })
  updatedBy: string | null;
}

@Entity('unit_classes')
export class UnitClass extends TenantEntity {
  @Column('uuid')
  unitId: string;

  @Column('uuid')
  classId: string;
}

@Entity('unit_standards')
export class UnitStandard extends TenantEntity {
  @Column('uuid')
  unitId: string;

  @Column('uuid')
  standardId: string;
}

export const COLLABORATOR_ROLES = ['editor', 'viewer'] as const;
export type CollaboratorRole = (typeof COLLABORATOR_ROLES)[number];

@Entity('unit_collaborators')
export class UnitCollaborator extends TenantEntity {
  @Column('uuid')
  unitId: string;

  @Column('uuid')
  userId: string;

  @Column('text')
  role: CollaboratorRole;
}

@Entity('unit_assessments')
export class UnitAssessment extends TenantEntity {
  @Column('uuid')
  unitId: string;

  @Column('uuid')
  assessmentId: string;
}

@Entity('lessons')
export class Lesson extends TenantEntity {
  @Column('uuid')
  unitId: string;

  @Column('text')
  title: string;

  @Column('date', { nullable: true })
  date: string | null;

  @Column('jsonb', { nullable: true })
  objectives: RichTextNode | null;

  @Column('jsonb', { nullable: true })
  activities: RichTextNode | null;

  @Column('jsonb', { nullable: true })
  resources: RichTextNode | null;

  @Column('integer')
  sortOrder: number;

  @Column('uuid', { nullable: true })
  updatedBy: string | null;
}
