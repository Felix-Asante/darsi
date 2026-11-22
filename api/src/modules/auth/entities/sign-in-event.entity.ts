import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/** Append-only record of every sign-in, across schools. */
@Entity('sign_in_events')
export class SignInEvent {
  @PrimaryColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @Column('text', { nullable: true })
  ipAddress: string | null;

  @Column('text', { nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
