import { AppDataSource } from '../db/data-source';
import { Submission } from '../entities/submission.entity';
import { Vendor } from '../entities/vendor.entity';

/**
 * Resolve the Vendor row that belongs to the given user. Auto-provisions a
 * Vendor row on first call so that newly-invited vendors can immediately
 * start a submission without an explicit "create vendor profile" step.
 */
export async function getOrCreateVendorForUser(userId: string): Promise<Vendor> {
  const repo = AppDataSource.getRepository(Vendor);
  const existing = await repo.findOneBy({ userId });
  if (existing) return existing;
  return repo.save({ userId, companyName: null });
}

export async function createDraftForVendor(vendorId: string): Promise<Submission> {
  const repo = AppDataSource.getRepository(Submission);
  return repo.save({
    vendorId,
    status: 'Draft',
    formDataJson: {},
    currentStep: 1,
  });
}
