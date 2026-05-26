import request from 'supertest';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../db/data-source';
import { Submission } from '../entities/submission.entity';
import { User, type UserRole } from '../entities/user.entity';
import { Vendor } from '../entities/vendor.entity';
import { createApp } from '../app';

const JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
function tokenFor(userId: string, role: UserRole): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '1h' });
}

describe('GET /api/submissions/:id (checker / admin)', () => {
  beforeAll(async () => {
    await AppDataSource.initialize();
  });
  afterAll(async () => {
    await AppDataSource.destroy();
  });
  beforeEach(async () => {
    await AppDataSource.synchronize(true);
  });

  it('checker can read any submission detail', async () => {
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
      status: 'In-Process',
    });
    const checker = await AppDataSource.getRepository(User).save({
      email: 'c@example.com',
      role: 'checker',
    });
    const token = tokenFor(checker.id, 'checker');

    const res = await request(createApp())
      .get(`/api/submissions/${submission.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: submission.id,
      status: 'In-Process',
      vendorId: vendor.id,
      vendorName: 'Acme',
    });
  });

  it('checker fetching an unknown submission gets 404 (not 403)', async () => {
    const checker = await AppDataSource.getRepository(User).save({
      email: 'c@example.com',
      role: 'checker',
    });
    const token = tokenFor(checker.id, 'checker');

    const res = await request(createApp())
      .get('/api/submissions/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
