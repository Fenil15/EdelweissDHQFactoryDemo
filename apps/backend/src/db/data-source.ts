import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';
import { Vendor } from '../entities/vendor.entity';
import { Submission } from '../entities/submission.entity';
import { Document } from '../entities/document.entity';
import { AuditLog } from '../entities/audit-log.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: true,
  logging: false,
  entities: [User, Vendor, Submission, Document, AuditLog],
});
