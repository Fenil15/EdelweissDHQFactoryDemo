import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Submission } from './submission.entity';
import { User } from './user.entity';

/**
 * Append-only audit trail for submission lifecycle events. By convention,
 * rows are never updated or deleted — only inserted. There is intentionally
 * no `updatedAt` column.
 */
@Entity({ name: 'audit_logs' })
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  submissionId!: string;

  @ManyToOne(() => Submission)
  @JoinColumn({ name: 'submissionId' })
  submission?: Submission;

  @Column({ type: 'uuid' })
  actorUserId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'actorUserId' })
  actor?: User;

  @Column({ type: 'varchar' })
  action!: string;

  @Column({ type: 'varchar', nullable: true })
  fromStatus!: string | null;

  @Column({ type: 'varchar', nullable: true })
  toStatus!: string | null;

  @Column({ type: 'text', nullable: true })
  comments!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
