import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Organization } from './organization.entity.js';
import { User } from './user.entity.js';

/** A user's membership and roles in one school. Read-only here; write through the auth API. */
@Entity({ name: 'members', synchronize: false })
export class Member {
  @PrimaryColumn('uuid')
  id: string;

  @Column('uuid')
  organizationId: string;

  @Column('uuid')
  userId: string;

  /** Comma-separated roles, as Better Auth stores them. */
  @Column('text')
  role: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization;
}
