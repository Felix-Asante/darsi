import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/** Owned by Better Auth. Read-only here; write through the auth API. */
@Entity({ name: 'users', synchronize: false })
export class User {
  @PrimaryColumn('uuid')
  id: string;

  @Column('text')
  name: string;

  @Column('text')
  email: string;

  @Column('boolean')
  emailVerified: boolean;

  @Column('text', { nullable: true })
  image: string | null;

  @Column('text', { nullable: true })
  locale: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
