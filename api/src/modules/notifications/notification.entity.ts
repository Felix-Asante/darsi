import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/** An in-app notice. The frontend renders `type` and `params` in the reader's language. */
@Entity('notifications')
export class Notification {
  @PrimaryColumn('uuid')
  id: string;

  @Column('uuid')
  schoolId: string;

  @Column('uuid')
  userId: string;

  @Column('text')
  type: string;

  @Column('jsonb')
  params: Record<string, string | number | boolean | null>;

  /** An app path, such as `/classes/…/gradebook`, opened when the notice is clicked. */
  @Column('text', { nullable: true })
  link: string | null;

  @Column('timestamptz', { nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
