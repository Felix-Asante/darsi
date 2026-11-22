import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/** A school, as Better Auth stores it. Read-only here; settings live in `schools`. */
@Entity({ name: 'organizations', synchronize: false })
export class Organization {
  @PrimaryColumn('uuid')
  id: string;

  @Column('text')
  name: string;

  @Column('text')
  slug: string;

  @Column('text', { nullable: true })
  logo: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
