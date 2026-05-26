import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Vendor } from './vendor.entity';

export type SubmissionStatus =
  | 'Draft'
  | 'In-Process'
  | 'Completed'
  | 'Rejected'
  | 'Modification-Required';

@Entity({ name: 'submissions' })
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  vendorId!: string;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendorId' })
  vendor?: Vendor;

  @Column({
    type: 'enum',
    enum: ['Draft', 'In-Process', 'Completed', 'Rejected', 'Modification-Required'],
    default: 'Draft',
  })
  status!: SubmissionStatus;

  @Column({ type: 'jsonb', default: {} })
  formDataJson!: Record<string, unknown>;

  @Column({ type: 'int', default: 1 })
  currentStep!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
