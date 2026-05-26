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

async function seedVendor(email = 'vendor@example.com'): Promise<{
  user: User;
  vendor: Vendor;
  token: string;
}> {
  const userRepo = AppDataSource.getRepository(User);
  const vendorRepo = AppDataSource.getRepository(Vendor);
  const user = await userRepo.save({ email, role: 'vendor' as UserRole });
  const vendor = await vendorRepo.save({ userId: user.id, companyName: null });
  return { user, vendor, token: tokenFor(user.id, 'vendor') };
}

async function seedSubmission(
  vendorId: string,
  status: 'Draft' | 'In-Process' | 'Completed' | 'Rejected' | 'Modification-Required' = 'Draft',
): Promise<Submission> {
  return AppDataSource.getRepository(Submission).save({ vendorId, status });
}

describe('POST /api/submissions/:id/submit', () => {
  beforeAll(async () => {
    await AppDataSource.initialize();
  });
  afterAll(async () => {
    await AppDataSource.destroy();
  });
  beforeEach(async () => {
    await AppDataSource.synchronize(true);
  });

  it('401 when no Authorization header is supplied', async () => {
    const { vendor } = await seedVendor();
    const sub = await seedSubmission(vendor.id);
    const res = await request(createApp()).post(`/api/submissions/${sub.id}/submit`).send({});
    expect(res.status).toBe(401);
  });

  it('403 for a checker calling /submit', async () => {
    const { vendor } = await seedVendor();
    const sub = await seedSubmission(vendor.id);
    const checker = await AppDataSource.getRepository(User).save({
      email: 'c@example.com',
      role: 'checker',
    });
    const token = tokenFor(checker.id, 'checker');
    const res = await request(createApp())
      .post(`/api/submissions/${sub.id}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('404 when the submission belongs to a different vendor (no leak)', async () => {
    const { vendor: ownerVendor } = await seedVendor('owner@example.com');
    const { token: otherToken } = await seedVendor('other@example.com');
    const sub = await seedSubmission(ownerVendor.id);
    const res = await request(createApp())
      .post(`/api/submissions/${sub.id}/submit`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({});
    expect(res.status).toBe(404);
  });

  it('404 when the submission id is unknown', async () => {
    const { token } = await seedVendor();
    const res = await request(createApp())
      .post(`/api/submissions/00000000-0000-0000-0000-000000000000/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(404);
  });

  it('409 invalid_transition when status is already In-Process', async () => {
    const { vendor, token } = await seedVendor();
    const sub = await seedSubmission(vendor.id, 'In-Process');
    const res = await request(createApp())
      .post(`/api/submissions/${sub.id}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: 'invalid_transition' });
  });

  it('409 when status is Completed', async () => {
    const { vendor, token } = await seedVendor();
    const sub = await seedSubmission(vendor.id, 'Completed');
    const res = await request(createApp())
      .post(`/api/submissions/${sub.id}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(409);
  });

  it('200 happy path: Draft → In-Process + audit row + checker email', async () => {
    const { user, vendor, token } = await seedVendor();
    const sub = await seedSubmission(vendor.id);
    await AppDataSource.getRepository(User).save({ email: 'c@example.com', role: 'checker' });

    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    let lines: string[];
    let res: request.Response;
    try {
      res = await request(createApp())
        .post(`/api/submissions/${sub.id}/submit`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      lines = spy.mock.calls.map((c) => String(c[0]));
    } finally {
      spy.mockRestore();
    }

    expect(res!.status).toBe(200);
    expect(res!.body).toMatchObject({ id: sub.id, status: 'In-Process' });

    // Status persisted
    const after = await AppDataSource.getRepository(Submission).findOneBy({ id: sub.id });
    expect(after?.status).toBe('In-Process');

    // Audit row written
    const logs = await AppDataSource.getRepository(AuditLog).find({
      where: { submissionId: sub.id },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      submissionId: sub.id,
      actorUserId: user.id,
      action: 'submit',
      fromStatus: 'Draft',
      toStatus: 'In-Process',
      comments: null,
    });

    // Checker email logged
    const emailLines = lines.filter((l) => l.startsWith('[EMAIL] '));
    expect(emailLines.some((l) => l.includes('to=c@example.com'))).toBe(true);
    expect(emailLines.some((l) => l.includes(`submissionId=${sub.id}`))).toBe(true);
  });

  it('200 resubmit path: Modification-Required → In-Process', async () => {
    const { vendor, token } = await seedVendor();
    const sub = await seedSubmission(vendor.id, 'Modification-Required');

    const res = await request(createApp())
      .post(`/api/submissions/${sub.id}/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'In-Process' });

    const logs = await AppDataSource.getRepository(AuditLog).find({
      where: { submissionId: sub.id },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      action: 'submit',
      fromStatus: 'Modification-Required',
      toStatus: 'In-Process',
    });
  });
});
