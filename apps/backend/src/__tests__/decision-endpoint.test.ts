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

async function seedVendorWithSubmission(
  email = 'vendor@example.com',
  status: SubmissionStatus = 'In-Process',
): Promise<{ vendorUser: User; vendor: Vendor; submission: Submission }> {
  const vendorUser = await AppDataSource.getRepository(User).save({
    email,
    role: 'vendor',
  });
  const vendor = await AppDataSource.getRepository(Vendor).save({
    userId: vendorUser.id,
    companyName: 'Acme',
  });
  const submission = await AppDataSource.getRepository(Submission).save({
    vendorId: vendor.id,
    status,
  });
  return { vendorUser, vendor, submission };
}

async function seedChecker(email = 'checker@example.com'): Promise<{ user: User; token: string }> {
  const user = await AppDataSource.getRepository(User).save({ email, role: 'checker' });
  return { user, token: tokenFor(user.id, 'checker') };
}

async function seedAdmin(email = 'admin@example.com'): Promise<{ user: User; token: string }> {
  const user = await AppDataSource.getRepository(User).save({ email, role: 'admin' });
  return { user, token: tokenFor(user.id, 'admin') };
}

describe('POST /api/submissions/:id/decision', () => {
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
    const { submission } = await seedVendorWithSubmission();
    const res = await request(createApp())
      .post(`/api/submissions/${submission.id}/decision`)
      .send({ action: 'approve', comments: 'ok' });
    expect(res.status).toBe(401);
  });

  it('403 when a vendor tries to decide', async () => {
    const { vendorUser, submission } = await seedVendorWithSubmission();
    const token = tokenFor(vendorUser.id, 'vendor');
    const res = await request(createApp())
      .post(`/api/submissions/${submission.id}/decision`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'approve', comments: 'ok' });
    expect(res.status).toBe(403);
  });

  it('400 when action is missing or unknown', async () => {
    const { submission } = await seedVendorWithSubmission();
    const { token } = await seedChecker();
    const missing = await request(createApp())
      .post(`/api/submissions/${submission.id}/decision`)
      .set('Authorization', `Bearer ${token}`)
      .send({ comments: 'ok' });
    expect(missing.status).toBe(400);

    const bogus = await request(createApp())
      .post(`/api/submissions/${submission.id}/decision`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'banish', comments: 'ok' });
    expect(bogus.status).toBe(400);
  });

  it('422 when comments are missing, empty, or whitespace-only', async () => {
    const { submission } = await seedVendorWithSubmission();
    const { token } = await seedChecker();

    for (const body of [
      { action: 'approve' },
      { action: 'approve', comments: '' },
      { action: 'approve', comments: '   ' },
      { action: 'approve', comments: 123 },
    ]) {
      const res = await request(createApp())
        .post(`/api/submissions/${submission.id}/decision`)
        .set('Authorization', `Bearer ${token}`)
        .send(body);
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ error: 'comments_required' });
    }
  });

  it('404 when submission id is unknown', async () => {
    const { token } = await seedChecker();
    const res = await request(createApp())
      .post(`/api/submissions/00000000-0000-0000-0000-000000000000/decision`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'approve', comments: 'ok' });
    expect(res.status).toBe(404);
  });

  it('409 when status is not In-Process (e.g. Draft)', async () => {
    const { submission } = await seedVendorWithSubmission('v@example.com', 'Draft');
    const { token } = await seedChecker();
    const res = await request(createApp())
      .post(`/api/submissions/${submission.id}/decision`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'approve', comments: 'ok' });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: 'invalid_transition' });
  });

  it('409 when status is Completed (final state)', async () => {
    const { submission } = await seedVendorWithSubmission('v@example.com', 'Completed');
    const { token } = await seedChecker();
    const res = await request(createApp())
      .post(`/api/submissions/${submission.id}/decision`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'approve', comments: 'ok' });
    expect(res.status).toBe(409);
  });

  type Case = { action: 'approve' | 'reject' | 'request-modification'; expected: SubmissionStatus };
  const cases: Case[] = [
    { action: 'approve', expected: 'Completed' },
    { action: 'reject', expected: 'Rejected' },
    { action: 'request-modification', expected: 'Modification-Required' },
  ];

  for (const { action, expected } of cases) {
    it(`200 happy path: In-Process --${action}--> ${expected} + audit + vendor email`, async () => {
      const { vendorUser, submission } = await seedVendorWithSubmission('v@example.com');
      const { user: checker, token } = await seedChecker();

      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      let lines: string[];
      let res: request.Response;
      try {
        res = await request(createApp())
          .post(`/api/submissions/${submission.id}/decision`)
          .set('Authorization', `Bearer ${token}`)
          .send({ action, comments: 'because reasons' });
        lines = spy.mock.calls.map((c) => String(c[0]));
      } finally {
        spy.mockRestore();
      }

      expect(res!.status).toBe(200);
      expect(res!.body).toMatchObject({ id: submission.id, status: expected });

      const after = await AppDataSource.getRepository(Submission).findOneBy({ id: submission.id });
      expect(after?.status).toBe(expected);

      const logs = await AppDataSource.getRepository(AuditLog).find({
        where: { submissionId: submission.id },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        submissionId: submission.id,
        actorUserId: checker.id,
        action,
        fromStatus: 'In-Process',
        toStatus: expected,
        comments: 'because reasons',
      });

      // Vendor email logged (mentions vendor email + decision details).
      const emailLines = lines.filter((l) => l.startsWith('[EMAIL] '));
      const vendorLine = emailLines.find((l) => l.includes(`to=${vendorUser.email}`));
      expect(vendorLine).toBeDefined();
      expect(vendorLine).toContain(`submissionId=${submission.id}`);
      expect(vendorLine).toContain(`status=${expected}`);
      expect(vendorLine).toContain(`action=${action}`);
      expect(vendorLine).toContain('because reasons');
    });
  }

  it('admin role can also issue a decision (approves)', async () => {
    const { submission } = await seedVendorWithSubmission();
    const { user: admin, token } = await seedAdmin();
    const res = await request(createApp())
      .post(`/api/submissions/${submission.id}/decision`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'approve', comments: 'override' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'Completed' });

    const logs = await AppDataSource.getRepository(AuditLog).find({
      where: { submissionId: submission.id },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].actorUserId).toBe(admin.id);
  });

  it('full request-mod → resubmit cycle leaves an audit trail of two transitions', async () => {
    const { vendorUser, submission } = await seedVendorWithSubmission('v@example.com');
    const vendorToken = tokenFor(vendorUser.id, 'vendor');
    const { token: checkerToken } = await seedChecker();

    const decision = await request(createApp())
      .post(`/api/submissions/${submission.id}/decision`)
      .set('Authorization', `Bearer ${checkerToken}`)
      .send({ action: 'request-modification', comments: 'add PAN scan' });
    expect(decision.status).toBe(200);
    expect(decision.body.status).toBe('Modification-Required');

    const resubmit = await request(createApp())
      .post(`/api/submissions/${submission.id}/submit`)
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({});
    expect(resubmit.status).toBe(200);
    expect(resubmit.body.status).toBe('In-Process');

    const logs = await AppDataSource.getRepository(AuditLog).find({
      where: { submissionId: submission.id },
      order: { createdAt: 'ASC' },
    });
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({
      action: 'request-modification',
      fromStatus: 'In-Process',
      toStatus: 'Modification-Required',
    });
    expect(logs[1]).toMatchObject({
      action: 'submit',
      fromStatus: 'Modification-Required',
      toStatus: 'In-Process',
    });
  });
});
