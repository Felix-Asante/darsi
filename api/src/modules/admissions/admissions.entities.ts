import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../common/entities/tenant.entity.js';
import type { Relationship } from '../people/entities/guardian-link.entity.js';

const bigintAsBigInt = {
  to: (value: bigint | null) => (value === null ? null : value.toString()),
  from: (value: string | null) => (value === null ? null : BigInt(value)),
};

export interface CycleGrade {
  gradeLevelId: string;
  places: number;
}

/** When families can apply for which grades, and what it costs (ADMS-1, ADMS-10, ADMS-12). */
@Entity('admission_cycles')
export class AdmissionCycle extends TenantEntity {
  @Column('uuid')
  academicYearId: string;

  @Column('text')
  name: string;

  @Column('date')
  opensOn: string;

  @Column('date')
  closesOn: string;

  @Column('jsonb')
  grades: CycleGrade[];

  @Column('bigint', { transformer: bigintAsBigInt })
  applicationFee: bigint;

  @Column('uuid', { nullable: true })
  depositFeeItemId: string | null;
}

export const FIELD_TYPES = [
  'text',
  'textarea',
  'date',
  'select',
  'checkbox',
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export interface FormField {
  key: string;
  label: { en: string; fr?: string };
  type: FieldType;
  required: boolean;
  options?: string[];
}

export interface FormDocument {
  key: string;
  label: { en: string; fr?: string };
  required: boolean;
}

/** The questions and documents asked for, for one division or the whole school (ADMS-2). */
@Entity('admission_forms')
export class AdmissionForm extends TenantEntity {
  @Column('uuid', { nullable: true })
  divisionId: string | null;

  @Column('jsonb')
  fields: FormField[];

  @Column('jsonb')
  documents: FormDocument[];
}

export const STAGE_KINDS = [
  'enquiry',
  'submitted',
  'review',
  'interview',
  'offered',
  'accepted',
  'enrolled',
  'waitlisted',
  'declined',
  'withdrawn',
] as const;
export type StageKind = (typeof STAGE_KINDS)[number];

export interface StageEmail {
  en: { subject: string; body: string };
  fr?: { subject: string; body: string };
}

/** A step in the school's pipeline; moving an application here can email the family (ADMS-5, ADMS-8). */
@Entity('admission_stages')
export class AdmissionStage extends TenantEntity {
  @Column('text')
  name: string;

  @Column('text')
  kind: StageKind;

  @Column('integer')
  sortOrder: number;

  @Column('jsonb', { nullable: true })
  email: StageEmail | null;
}

@Entity('applications')
export class Application extends TenantEntity {
  @Column('uuid')
  cycleId: string;

  @Column('uuid')
  gradeLevelId: string;

  @Column('uuid')
  applicantUserId: string;

  @Column('text')
  status: 'draft' | 'submitted';

  @Column('uuid', { nullable: true })
  stageId: string | null;

  @Column('text', { nullable: true })
  studentFirstName: string | null;

  @Column('text', { nullable: true })
  studentLastName: string | null;

  @Column('text', { nullable: true })
  studentPreferredName: string | null;

  @Column('date', { nullable: true })
  studentDateOfBirth: string | null;

  @Column('text', { nullable: true })
  guardianFirstName: string | null;

  @Column('text', { nullable: true })
  guardianLastName: string | null;

  @Column('text')
  guardianEmail: string;

  @Column('text', { nullable: true })
  guardianPhone: string | null;

  @Column('text', { nullable: true })
  guardianRelationship: Relationship | null;

  @Column('text')
  locale: string;

  @Column('jsonb')
  answers: Record<string, string | boolean>;

  @Column('timestamptz', { nullable: true })
  submittedAt: Date | null;

  @Column('uuid', { nullable: true })
  familyId: string | null;

  @Column('uuid', { nullable: true })
  feeInvoiceId: string | null;

  @Column('date', { nullable: true })
  offerExpiresOn: string | null;

  @Column('text', { nullable: true })
  offerResponse: 'accepted' | 'declined' | null;

  @Column('timestamptz', { nullable: true })
  respondedAt: Date | null;

  @Column('uuid', { nullable: true })
  studentId: string | null;
}

/** Personal data columns, used by export, deletion and pseudonymisation. */
export const APPLICATION_PII_FIELDS = [
  'studentFirstName',
  'studentLastName',
  'studentPreferredName',
  'studentDateOfBirth',
  'guardianFirstName',
  'guardianLastName',
  'guardianEmail',
  'guardianPhone',
  'answers',
] as const;

@Entity('application_documents')
export class ApplicationDocument extends TenantEntity {
  @Column('uuid')
  applicationId: string;

  @Column('text')
  key: string;

  @Column('uuid')
  fileId: string;
}

/** Staff-only: never returned to the family (ADMS-7). */
@Entity('application_notes')
export class ApplicationNote extends TenantEntity {
  @Column('uuid')
  applicationId: string;

  @Column('uuid')
  authorId: string;

  @Column('text')
  kind: 'note' | 'rating' | 'interview';

  @Column('text')
  body: string;

  @Column('integer', { nullable: true })
  rating: number | null;
}

export const APPLICATION_NOTE_PII_FIELDS = ['body'] as const;

/** A current student's place next year, confirmed by the family (ADMS-13). A null grade means leaving. */
@Entity('re_enrolments')
export class ReEnrolment extends TenantEntity {
  @Column('uuid')
  studentId: string;

  @Column('uuid')
  academicYearId: string;

  @Column('uuid', { nullable: true })
  gradeLevelId: string | null;

  @Column('text')
  status: 'pending' | 'confirmed' | 'declined' | 'applied';

  @Column('uuid', { nullable: true })
  respondedBy: string | null;

  @Column('timestamptz', { nullable: true })
  respondedAt: Date | null;
}
