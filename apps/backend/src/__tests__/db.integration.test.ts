import { AppDataSource } from '../db/data-source';
import { User } from '../entities/user.entity';
import { Vendor } from '../entities/vendor.entity';

describe('TypeORM DataSource', () => {
  beforeAll(async () => {
    await AppDataSource.initialize();
  });

  afterAll(async () => {
    await AppDataSource.destroy();
  });

  beforeEach(async () => {
    await AppDataSource.synchronize(true); // drop + recreate
  });

  it('persists and reads back a Vendor', async () => {
    const userRepo = AppDataSource.getRepository(User);
    const vendorRepo = AppDataSource.getRepository(Vendor);
    const u = await userRepo.save({ email: 't@example.com', role: 'vendor' });
    const v = await vendorRepo.save({ userId: u.id, companyName: 'Acme' });
    const found = await vendorRepo.findOneByOrFail({ id: v.id });
    expect(found.companyName).toBe('Acme');
  });
});
