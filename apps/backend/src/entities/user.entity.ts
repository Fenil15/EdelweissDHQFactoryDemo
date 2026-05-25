import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type UserRole = 'vendor' | 'checker' | 'admin';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  email!: string;

  @Column({ type: 'enum', enum: ['vendor', 'checker', 'admin'] })
  role!: UserRole;

  @Column({ type: 'varchar', nullable: true })
  otpHash!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  otpExpiresAt!: Date | null;

  @Column({ type: 'int', default: 0 })
  otpFailCount!: number;

  @Column({ type: 'timestamptz', nullable: true })
  lockedUntil!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
