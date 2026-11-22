import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

export const SCHOOL_LOCALES = ['en', 'fr'] as const;
export type SchoolLocale = (typeof SCHOOL_LOCALES)[number];

/** Settings Better Auth's organization doesn't hold. One row per school, keyed by its organization id. */
@Entity('schools')
export class School {
  @PrimaryColumn('uuid')
  schoolId: string;

  @Column('text')
  defaultLocale: SchoolLocale;

  /** IANA zone, such as `Europe/Paris`. Local dates and the school day are read in it. */
  @Column('text')
  timeZone: string;

  /** ISO 4217 code. The school's single billing currency. */
  @Column('char', { length: 3 })
  currency: string;

  @Column('text')
  hostingRegion: string;

  @Column('timestamptz', { nullable: true })
  onboardingCompletedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @VersionColumn()
  version: number;
}
