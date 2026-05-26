import { AppDataSource } from '../db/data-source';
import { AuditLog } from '../entities/audit-log.entity';
import { Submission } from '../entities/submission.entity';
import { User } from '../entities/user.entity';
import { Vendor } from '../entities/vendor.entity';
import * as auditLogService from '../services/audit-log.service';

describe('auditLogService.writeTransition', () => {
  beforeAll(async () => {
    await AppDataSource.initialize();
  });
  afterAll(async () => {
    await AppDataSource.destroy();
  });
  beforeEach(async () => {
    await AppDataSource.synchronize(true);
  });

  async function seedSubmission(): Promise<{ submission: Submission; user: User }> {
    const user = await AppDataSource.getRepository(User).save({
      email: 'v@example.com',
      role: 'vendor',
    });
    const vendor = await AppDataSource.getRepository(Vendor).save({
      userId: user.id,
      companyName: 'Acme',
    });
    const submission = await AppDataSource.getRepository(Submission).save({
      vendorId: vendor.id,
      status: 'Draft',
    });
    return { submission, user };
  }

  it('inserts a row with the requested transition fields', async () => {
    const { submission, user } = await seedSubmission();
    const row = await auditLogService.writeTransition({
      submissionId: submission.id,
      fromStatus: 'Draft',
      toStatus: 'In-Process',
      actorUserId: user.id,
      action: 'submit',
      comments: null,
    });

    expect(row.id).toEqual(expect.any(String));
    expect(row.submissionId).toBe(submission.id);
    expect(row.fromStatus).toBe('Draft');
    expect(row.toStatus).toBe('In-Process');
    expect(row.actorUserId).toBe(user.id);
    expect(row.action).toBe('submit');
    expect(row.comments).toBeNull();
    expect(row.createdAt).toBeInstanceOf(Date);

    const all = await AppDataSource.getRepository(AuditLog).find();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(row.id);
  });

  it('two writes append two distinct rows (no upsert/overwrite)', async () => {
    const { submission, user } = await seedSubmission();
    const first = await auditLogService.writeTransition({
      submissionId: submission.id,
      fromStatus: 'Draft',
      toStatus: 'In-Process',
      actorUserId: user.id,
      action: 'submit',
      comments: null,
    });
    const second = await auditLogService.writeTransition({
      submissionId: submission.id,
      fromStatus: 'In-Process',
      toStatus: 'Completed',
      actorUserId: user.id,
      action: 'approve',
      comments: 'looks good',
    });

    expect(second.id).not.toBe(first.id);
    const repo = AppDataSource.getRepository(AuditLog);
    const all = await repo.find({ order: { createdAt: 'ASC' } });
    expect(all).toHaveLength(2);
    expect(all[0]).toMatchObject({
      id: first.id,
      action: 'submit',
      fromStatus: 'Draft',
      toStatus: 'In-Process',
      comments: null,
    });
    expect(all[1]).toMatchObject({
      id: second.id,
      action: 'approve',
      fromStatus: 'In-Process',
      toStatus: 'Completed',
      comments: 'looks good',
    });
  });

  it('module exposes no update or delete helper', () => {
    // The contract is "AuditLog is append-only". We guard that by not
    // exporting any mutation/deletion helper from the service.
    expect((auditLogService as Record<string, unknown>).updateTransition).toBeUndefined();
    expect((auditLogService as Record<string, unknown>).deleteTransition).toBeUndefined();
    expect((auditLogService as Record<string, unknown>).deleteAll).toBeUndefined();
  });
});
