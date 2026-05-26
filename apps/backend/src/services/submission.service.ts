import { AppDataSource } from '../db/data-source';
import { Submission } from '../entities/submission.entity';
import { Vendor } from '../entities/vendor.entity';

/**
 * Loads a submission only if it belongs to the given vendor. Returning null
 * when ownership fails (rather than throwing or returning the row) lets
 * callers respond with a `404` without leaking row existence.
 */
export async function findSubmissionOwnedBy(
  submissionId: string,
  vendorId: string,
): Promise<Submission | null> {
  const repo = AppDataSource.getRepository(Submission);
  const row = await repo.findOneBy({ id: submissionId });
  if (!row || row.vendorId !== vendorId) return null;
  return row;
}

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
