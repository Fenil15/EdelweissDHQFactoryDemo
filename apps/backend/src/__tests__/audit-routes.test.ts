import request from 'supertest';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../db/data-source';
import { AuditLog } from '../entities/audit-log.entity';
import { Submission, type SubmissionStatus } from '../entities/submission.entity';
import { User, type UserRole } from '../entities/user.entity';
import { Vendor } from '../entities/vendor.entity';
import { createApp } from '../app';

const JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
function tokenFor(userId: string, role: UserRole): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '1h' });
}

async function seed(): Promise<{
  vendorUser: User;
  vendor: Vendor;
  submission: Submission;
  checker: User;
  admin: User;
}> {
  const vendorUser = await AppDataSource.getRepository(User).save({
    email: 'v@example.com',
    role: 'vendor',
  });
  const vendor = await AppDataSource.getRepository(Vendor).save({
    userId: vendorUser.id,
    companyName: 'Acme',
  });
  const submission = await AppDataSource.getRepository(Submission).save({
    vendorId: vendor.id,
    status: 'Completed' as SubmissionStatus,
  });
  const checker = await AppDataSource.getRepository(User).save({
    email: 'c@example.com',
    role: 'checker',
  });
  const admin = await AppDataSource.getRepository(User).save({
    email: 'a@example.com',
    role: 'admin',
  });
  // Seed three audit entries spaced in time.
  const repo = AppDataSource.getRepository(AuditLog);
  await repo.save({
    submissionId: submission.id,
    actorUserId: vendorUser.id,
    action: 'submit',
    fromStatus: 'Draft',
    toStatus: 'In-Process',
    comments: null,
  });
  await new Promise((r) => setTimeout(r, 20));
  await repo.save({
    submissionId: submission.id,
    actorUserId: checker.id,
    action: 'request-modification',
    fromStatus: 'In-Process',
    toStatus: 'Modification-Required',
    comments: 'add PAN',
  });
  await new Promise((r) => setTimeout(r, 20));
  await repo.save({
    submissionId: submission.id,
    actorUserId: checker.id,
    action: 'approve',
    fromStatus: 'In-Process',
    toStatus: 'Completed',
    comments: 'looks good',
  });
  return { vendorUser, vendor, submission, checker, admin };
}

describe('GET /api/submissions/:id/audit', () => {
  beforeAll(async () => {
    await AppDataSource.initialize();
  });
  afterAll(async () => {
    await AppDataSource.destroy();
  });
  beforeEach(async () => {
    await AppDataSource.synchronize(true);
  });

  it('owning vendor sees their submission audit trail in chronological order', async () => {
    const { vendorUser, submission } = await seed();
    const token = tokenFor(vendorUser.id, 'vendor');

    const res = await request(createApp())
      .get(`/api/submissions/${submission.id}/audit`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0]).toMatchObject({
      action: 'submit',
      fromStatus: 'Draft',
      toStatus: 'In-Process',
    });
    expect(res.body[2]).toMatchObject({ action: 'approve', toStatus: 'Completed' });
    // Includes actorEmail to avoid an N+1 on the UI side.
    expect(res.body[0]).toHaveProperty('actorEmail', 'v@example.com');
    expect(res.body[2]).toHaveProperty('actorEmail', 'c@example.com');
  });

  it('checker can read any submission audit trail', async () => {
    const { checker, submission } = await seed();
    const token = tokenFor(checker.id, 'checker');

    const res = await request(createApp())
      .get(`/api/submissions/${submission.id}/audit`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });

  it('admin can read any submission audit trail', async () => {
    const { admin, submission } = await seed();
    const token = tokenFor(admin.id, 'admin');

    const res = await request(createApp())
      .get(`/api/submissions/${submission.id}/audit`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });

  it('non-owning vendor gets 404 (no leak)', async () => {
    const { submission } = await seed();
    const other = await AppDataSource.getRepository(User).save({
      email: 'o@example.com',
      role: 'vendor',
    });
    const token = tokenFor(other.id, 'vendor');

    const res = await request(createApp())
      .get(`/api/submissions/${submission.id}/audit`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('unauthenticated → 401', async () => {
    const { submission } = await seed();
    const res = await request(createApp()).get(`/api/submissions/${submission.id}/audit`);
    expect(res.status).toBe(401);
  });

  it('unknown submission id → 404 for checker too', async () => {
    const { checker } = await seed();
    const token = tokenFor(checker.id, 'checker');
    const res = await request(createApp())
      .get('/api/submissions/00000000-0000-0000-0000-000000000000/audit')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
