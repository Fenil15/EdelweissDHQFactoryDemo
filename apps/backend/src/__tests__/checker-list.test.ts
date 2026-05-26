import request from 'supertest';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../db/data-source';
import { Submission, type SubmissionStatus } from '../entities/submission.entity';
import { User, type UserRole } from '../entities/user.entity';
import { Vendor } from '../entities/vendor.entity';
import { createApp } from '../app';

const JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';

function tokenFor(userId: string, role: UserRole): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '1h' });
}

async function seedVendorWithSubmissions(
  email: string,
  companyName: string,
  statuses: SubmissionStatus[],
): Promise<{ user: User; vendor: Vendor; submissions: Submission[] }> {
  const user = await AppDataSource.getRepository(User).save({ email, role: 'vendor' });
  const vendor = await AppDataSource.getRepository(Vendor).save({
    userId: user.id,
    companyName,
  });
  const submissions: Submission[] = [];
  for (const status of statuses) {
    const sub = await AppDataSource.getRepository(Submission).save({
      vendorId: vendor.id,
      status,
    });
    submissions.push(sub);
  }
  return { user, vendor, submissions };
}

describe('GET /api/submissions (checker / cross-vendor)', () => {
  beforeAll(async () => {
    await AppDataSource.initialize();
  });
  afterAll(async () => {
    await AppDataSource.destroy();
  });
  beforeEach(async () => {
    await AppDataSource.synchronize(true);
  });

  it('checker sees rows from every vendor, with vendorName attached', async () => {
    const acme = await seedVendorWithSubmissions('a@example.com', 'Acme Pvt Ltd', ['In-Process']);
    const beta = await seedVendorWithSubmissions('b@example.com', 'Beta Corp', ['Draft']);
    const checker = await AppDataSource.getRepository(User).save({
      email: 'c@example.com',
      role: 'checker',
    });
    const token = tokenFor(checker.id, 'checker');

    const res = await request(createApp())
      .get('/api/submissions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);

    const byId = new Map<string, { id: string; vendorName: string | null; status: string }>();
    for (const row of res.body) byId.set(row.id, row);
    expect(byId.get(acme.submissions[0].id)).toMatchObject({
      status: 'In-Process',
      vendorName: 'Acme Pvt Ltd',
    });
    expect(byId.get(beta.submissions[0].id)).toMatchObject({
      status: 'Draft',
      vendorName: 'Beta Corp',
    });
  });
});
