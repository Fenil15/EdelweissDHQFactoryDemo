import request from 'supertest';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../db/data-source';
import { User } from '../entities/user.entity';
import { createApp } from '../app';

const JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';

function captureOtpFromConsole(): { restore: () => void; lastOtp: () => string | null } {
  const original = console.log;
  let last: string | null = null;
  console.log = (...args: unknown[]) => {
    const line = args.map((a) => String(a)).join(' ');
    const m = line.match(/OTP:\s*(\d{6})/);
    if (m) last = m[1];
  };
  return { restore: () => (console.log = original), lastOtp: () => last };
}

describe('Auth flow', () => {
  beforeAll(async () => {
    await AppDataSource.initialize();
  });

  afterAll(async () => {
    await AppDataSource.destroy();
  });

  beforeEach(async () => {
    await AppDataSource.synchronize(true);
  });

  describe('happy path: invite → request-otp → verify-otp', () => {
    it('admin invites a vendor, vendor logs in, JWT carries role', async () => {
      const app = createApp();
      const userRepo = AppDataSource.getRepository(User);

      // Seed: admin user (created directly so we can mint a JWT to call invite)
      const admin = await userRepo.save({ email: 'admin@example.com', role: 'admin' });
      const adminToken = jwt.sign({ userId: admin.id, role: admin.role }, JWT_SECRET, {
        expiresIn: '1h',
      });

      // 1. Admin invites a vendor
      const inviteRes = await request(app)
        .post('/api/auth/invite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'vendor@example.com', role: 'vendor' });
      expect(inviteRes.status).toBe(201);
      expect(inviteRes.body).toMatchObject({ email: 'vendor@example.com', role: 'vendor' });

      // 2. Vendor requests OTP
      const cap = captureOtpFromConsole();
      try {
        const reqRes = await request(app)
          .post('/api/auth/request-otp')
          .send({ email: 'vendor@example.com' });
        expect(reqRes.status).toBe(200);
        const otp = cap.lastOtp();
        expect(otp).toMatch(/^\d{6}$/);

        // 3. Vendor verifies OTP, receives JWT
        const verifyRes = await request(app)
          .post('/api/auth/verify-otp')
          .send({ email: 'vendor@example.com', otp });
        expect(verifyRes.status).toBe(200);
        expect(verifyRes.body.token).toEqual(expect.any(String));
        const decoded = jwt.verify(verifyRes.body.token, JWT_SECRET) as {
          userId: string;
          role: string;
        };
        expect(decoded.role).toBe('vendor');
        expect(decoded.userId).toEqual(expect.any(String));
      } finally {
        cap.restore();
      }
    });
  });

  describe('lockout', () => {
    it('locks user for 5 minutes after 3 failed OTP attempts', async () => {
      const app = createApp();
      const userRepo = AppDataSource.getRepository(User);
      await userRepo.save({ email: 'v@example.com', role: 'vendor' });

      const cap = captureOtpFromConsole();
      try {
        await request(app).post('/api/auth/request-otp').send({ email: 'v@example.com' });
        const realOtp = cap.lastOtp();

        // Three bad attempts
        for (let i = 0; i < 3; i++) {
          const r = await request(app)
            .post('/api/auth/verify-otp')
            .send({ email: 'v@example.com', otp: '000000' });
          expect(r.status).toBe(401);
        }

        // Fourth attempt — even with the correct OTP — must be locked out
        const locked = await request(app)
          .post('/api/auth/verify-otp')
          .send({ email: 'v@example.com', otp: realOtp });
        expect(locked.status).toBe(423);

        const after = await userRepo.findOneByOrFail({ email: 'v@example.com' });
        expect(after.lockedUntil).not.toBeNull();
        const lockMs = (after.lockedUntil as Date).getTime() - Date.now();
        // ~5 minutes (give a wide margin)
        expect(lockMs).toBeGreaterThan(4 * 60 * 1000);
        expect(lockMs).toBeLessThan(6 * 60 * 1000);
      } finally {
        cap.restore();
      }
    });
  });

  describe('RBAC', () => {
    it('non-admin caller of /api/auth/invite gets 403', async () => {
      const app = createApp();
      const userRepo = AppDataSource.getRepository(User);
      const vendor = await userRepo.save({ email: 'v2@example.com', role: 'vendor' });
      const vendorToken = jwt.sign({ userId: vendor.id, role: vendor.role }, JWT_SECRET, {
        expiresIn: '1h',
      });

      const res = await request(app)
        .post('/api/auth/invite')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ email: 'someone@example.com', role: 'checker' });
      expect(res.status).toBe(403);
    });

    it('missing/invalid JWT on /api/auth/invite gets 401', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/auth/invite')
        .send({ email: 'someone@example.com', role: 'checker' });
      expect(res.status).toBe(401);
    });
  });
});
