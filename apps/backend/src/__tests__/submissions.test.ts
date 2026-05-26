import request from 'supertest';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../db/data-source';
import { User, type UserRole } from '../entities/user.entity';
import { Vendor } from '../entities/vendor.entity';
import { Submission } from '../entities/submission.entity';
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

describe('PUT /api/submissions/:id', () => {
  beforeAll(async () => {
    await AppDataSource.initialize();
  });
  afterAll(async () => {
    await AppDataSource.destroy();
  });
  beforeEach(async () => {
    await AppDataSource.synchronize(true);
  });

  async function createDraftAsVendor(): Promise<{ id: string; token: string; user: User }> {
    const app = createApp();
    const { user } = await seedVendor();
    const token = tokenFor(user.id, 'vendor');
    const created = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    return { id: created.body.id, token, user };
  }

  it('owner updates a Draft with valid format fields → 200 + merged body', async () => {
    const app = createApp();
    const { id, token } = await createDraftAsVendor();

    const res = await request(app)
      .put(`/api/submissions/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentStep: 2,
        formDataJson: {
          companyInfo: {
            companyName: 'Acme Ltd',
            panNumber: 'ABCDE1234F',
          },
        },
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id,
      status: 'Draft',
      currentStep: 2,
      formDataJson: {
        companyInfo: { companyName: 'Acme Ltd', panNumber: 'ABCDE1234F' },
      },
    });
  });

  it('rejects invalid PAN with 400 + field error map', async () => {
    const app = createApp();
    const { id, token } = await createDraftAsVendor();

    const res = await request(app)
      .put(`/api/submissions/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        formDataJson: {
          companyInfo: { panNumber: 'INVALID' },
          banking: { ifsc: 'WRONG' },
          taxIds: { gstin: 'WRONG' },
          address: { pin: '012345' },
        },
      });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: 'invalid_format',
      errors: {
        panNumber: 'invalid_pan',
        ifsc: 'invalid_ifsc',
        gstin: 'invalid_gstin',
        pin: 'invalid_pin',
      },
    });
  });

  it('rejects PUT when status is not Draft with 409 invalid_status', async () => {
    const app = createApp();
    const { id, token } = await createDraftAsVendor();

    // Promote the row to In-Process directly via the repository.
    const repo = AppDataSource.getRepository(Submission);
    await repo.update({ id }, { status: 'In-Process' });

    const res = await request(app)
      .put(`/api/submissions/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ formDataJson: { companyInfo: { companyName: 'x' } } });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'invalid_status' });
  });

  it('non-owner gets 404 (no leak)', async () => {
    const app = createApp();
    const { id } = await createDraftAsVendor();
    const { user: otherUser } = await seedVendor('other@example.com');
    const otherToken = tokenFor(otherUser.id, 'vendor');

    const res = await request(app)
      .put(`/api/submissions/${id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ formDataJson: {} });

    expect(res.status).toBe(404);
  });
});
