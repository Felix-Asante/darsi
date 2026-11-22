import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export type AuditDiff = Record<string, { before: unknown; after: unknown }>;

@Entity('audit_events')
export class AuditEvent {
  @PrimaryColumn('uuid')
  id: string;

  @Column('uuid')
  schoolId: string;

  @Column('uuid', { nullable: true })
  actorId: string | null;

  @Column('text')
  action: string;

  @Column('text')
  entityType: string;

  @Column('text', { nullable: true })
  entityId: string | null;

  @Column('jsonb', { nullable: true })
  diff: AuditDiff | null;

  @Column('text', { nullable: true })
  requestId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
