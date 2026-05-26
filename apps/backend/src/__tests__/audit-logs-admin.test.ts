import request from 'supertest';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../db/data-source';
import { AuditLog } from '../entities/audit-log.entity';
import { Submission } from '../entities/submission.entity';
import { User, type UserRole } from '../entities/user.entity';
import { Vendor } from '../entities/vendor.entity';
import { createApp } from '../app';

const JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
function tokenFor(userId: string, role: UserRole): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '1h' });
}

async function seedAuditCorpus(): Promise<{
  admin: User;
  vendorUser: User;
  checker: User;
  submission: Submission;
  ids: string[];
}> {
  const admin = await AppDataSource.getRepository(User).save({
    email: 'a@example.com',
    role: 'admin',
  });
  const vendorUser = await AppDataSource.getRepository(User).save({
    email: 'v@example.com',
    role: 'vendor',
  });
  const checker = await AppDataSource.getRepository(User).save({
    email: 'c@example.com',
    role: 'checker',
  });
  const vendor = await AppDataSource.getRepository(Vendor).save({
    userId: vendorUser.id,
    companyName: 'Acme',
  });
  const submission = await AppDataSource.getRepository(Submission).save({
    vendorId: vendor.id,
    status: 'Completed',
  });
  const otherSub = await AppDataSource.getRepository(Submission).save({
    vendorId: vendor.id,
    status: 'In-Process',
  });
  const repo = AppDataSource.getRepository(AuditLog);
  const a = await repo.save({
    submissionId: submission.id,
    actorUserId: vendorUser.id,
    action: 'submit',
    fromStatus: 'Draft',
    toStatus: 'In-Process',
    comments: null,
  });
  await new Promise((r) => setTimeout(r, 10));
  const b = await repo.save({
    submissionId: submission.id,
    actorUserId: checker.id,
    action: 'approve',
    fromStatus: 'In-Process',
    toStatus: 'Completed',
    comments: 'ok',
  });
  await new Promise((r) => setTimeout(r, 10));
  const c = await repo.save({
    submissionId: otherSub.id,
    actorUserId: vendorUser.id,
    action: 'submit',
    fromStatus: 'Draft',
    toStatus: 'In-Process',
    comments: null,
  });
  return { admin, vendorUser, checker, submission, ids: [a.id, b.id, c.id] };
}

describe('GET /api/audit-logs (admin)', () => {
  beforeAll(async () => {
    await AppDataSource.initialize();
  });
  afterAll(async () => {
    await AppDataSource.destroy();
  });
  beforeEach(async () => {
    await AppDataSource.synchronize(true);
  });

  it('401 without JWT', async () => {
    const res = await request(createApp()).get('/api/audit-logs');
    expect(res.status).toBe(401);
  });

  it('403 when vendor', async () => {
    const { vendorUser } = await seedAuditCorpus();
    const token = tokenFor(vendorUser.id, 'vendor');
    const res = await request(createApp())
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('403 when checker', async () => {
    const { checker } = await seedAuditCorpus();
    const token = tokenFor(checker.id, 'checker');
    const res = await request(createApp())
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('200 for admin, returns rows + total', async () => {
    const { admin } = await seedAuditCorpus();
    const token = tokenFor(admin.id, 'admin');
    const res = await request(createApp())
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total', 3);
    expect(res.body).toHaveProperty('rows');
    expect(res.body.rows).toHaveLength(3);
    // First row (DESC order) should have actorEmail populated.
    expect(res.body.rows[0]).toHaveProperty('actorEmail');
    expect(res.body.rows[0]).toHaveProperty('submissionId');
  });

  it('admin filters: action=approve narrows to 1 row', async () => {
    const { admin } = await seedAuditCorpus();
    const token = tokenFor(admin.id, 'admin');
    const res = await request(createApp())
      .get('/api/audit-logs?action=approve')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0]).toMatchObject({ action: 'approve' });
  });

  it('admin filters: submissionId substring narrows', async () => {
    const { admin, submission } = await seedAuditCorpus();
    const token = tokenFor(admin.id, 'admin');
    const tail = submission.id.slice(-8);
    const res = await request(createApp())
      .get(`/api/audit-logs?submissionId=${tail}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    // Two entries are on `submission`; one is on the other submission.
    expect(res.body.total).toBe(2);
  });

  it('admin filters: actorEmail substring narrows', async () => {
    const { admin } = await seedAuditCorpus();
    const token = tokenFor(admin.id, 'admin');
    const res = await request(createApp())
      .get('/api/audit-logs?actorEmail=c@')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.rows[0]).toMatchObject({ actorEmail: 'c@example.com' });
  });

  it('admin pagination: limit + offset', async () => {
    const { admin } = await seedAuditCorpus();
    const token = tokenFor(admin.id, 'admin');
    const first = await request(createApp())
      .get('/api/audit-logs?limit=2&offset=0')
      .set('Authorization', `Bearer ${token}`);
    expect(first.status).toBe(200);
    expect(first.body.rows).toHaveLength(2);
    expect(first.body.total).toBe(3);
    const second = await request(createApp())
      .get('/api/audit-logs?limit=2&offset=2')
      .set('Authorization', `Bearer ${token}`);
    expect(second.body.rows).toHaveLength(1);
    expect(second.body.total).toBe(3);
  });
});
