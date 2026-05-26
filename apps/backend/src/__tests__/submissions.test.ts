import request from 'supertest';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../db/data-source';
import { User, type UserRole } from '../entities/user.entity';
import { Vendor } from '../entities/vendor.entity';
import { createApp } from '../app';

const JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';

function tokenFor(userId: string, role: UserRole): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '1h' });
}

async function seedVendor(email = 'vendor@example.com'): Promise<{ user: User; vendor: Vendor }> {
  const userRepo = AppDataSource.getRepository(User);
  const vendorRepo = AppDataSource.getRepository(Vendor);
  const user = await userRepo.save({ email, role: 'vendor' as UserRole });
  const vendor = await vendorRepo.save({ userId: user.id, companyName: null });
  return { user, vendor };
}

describe('POST /api/submissions', () => {
  beforeAll(async () => {
    await AppDataSource.initialize();
  });
  afterAll(async () => {
    await AppDataSource.destroy();
  });
  beforeEach(async () => {
    await AppDataSource.synchronize(true);
  });

  it('vendor creates a Draft submission tied to their vendor row', async () => {
    const app = createApp();
    const { user, vendor } = await seedVendor();
    const token = tokenFor(user.id, 'vendor');

    const res = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'Draft',
      currentStep: 1,
      vendorId: vendor.id,
      formDataJson: {},
    });
    expect(typeof res.body.id).toBe('string');
  });

  it('unauthenticated request gets 401', async () => {
    const res = await request(createApp()).post('/api/submissions').send({});
    expect(res.status).toBe(401);
  });

  it('non-vendor role (admin) gets 403', async () => {
    const app = createApp();
    const userRepo = AppDataSource.getRepository(User);
    const admin = await userRepo.save({ email: 'a@example.com', role: 'admin' });
    const token = tokenFor(admin.id, 'admin');

    const res = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(403);
  });
});

describe('GET /api/submissions/:id', () => {
  beforeAll(async () => {
    await AppDataSource.initialize();
  });
  afterAll(async () => {
    await AppDataSource.destroy();
  });
  beforeEach(async () => {
    await AppDataSource.synchronize(true);
  });

  it('owner can fetch their own draft', async () => {
    const app = createApp();
    const { user, vendor } = await seedVendor();
    const token = tokenFor(user.id, 'vendor');

    const created = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    const id = created.body.id;

    const res = await request(app)
      .get(`/api/submissions/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id, vendorId: vendor.id, status: 'Draft' });
  });

  it('another vendor reading the same id gets 404 (no leak)', async () => {
    const app = createApp();
    const { user: ownerUser } = await seedVendor('owner@example.com');
    const { user: otherUser } = await seedVendor('other@example.com');
    const ownerToken = tokenFor(ownerUser.id, 'vendor');
    const otherToken = tokenFor(otherUser.id, 'vendor');

    const created = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    const id = created.body.id;

    const res = await request(app)
      .get(`/api/submissions/${id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });

  it('admin role gets 403 (role gate, not 404)', async () => {
    const app = createApp();
    const { user: vendorUser } = await seedVendor();
    const userRepo = AppDataSource.getRepository(User);
    const admin = await userRepo.save({ email: 'a@example.com', role: 'admin' });
    const vendorToken = tokenFor(vendorUser.id, 'vendor');
    const adminToken = tokenFor(admin.id, 'admin');

    const created = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({});
    const id = created.body.id;

    const res = await request(app)
      .get(`/api/submissions/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });

  it('unknown id (well-formed uuid) returns 404 for a vendor', async () => {
    const app = createApp();
    const { user } = await seedVendor();
    const token = tokenFor(user.id, 'vendor');

    const res = await request(app)
      .get('/api/submissions/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
