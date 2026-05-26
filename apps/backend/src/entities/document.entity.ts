import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Submission } from './submission.entity';

@Entity({ name: 'documents' })
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  submissionId!: string;

  @ManyToOne(() => Submission)
  @JoinColumn({ name: 'submissionId' })
  submission?: Submission;

  @Column({ type: 'varchar' })
  fileName!: string;

  @Column({ type: 'varchar' })
  mimeType!: string;

  @Column({ type: 'int' })
  sizeBytes!: number;

  @Column({ type: 'varchar' })
  storagePath!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  uploadedAt!: Date;
}
