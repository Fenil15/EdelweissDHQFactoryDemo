import { AppDataSource } from '../db/data-source';
import { Submission, type SubmissionStatus } from '../entities/submission.entity';
import { Vendor } from '../entities/vendor.entity';

export async function listSubmissionsForVendor(
  vendorId: string,
  status?: SubmissionStatus,
): Promise<Submission[]> {
  const repo = AppDataSource.getRepository(Submission);
  return repo.find({
    where: status ? { vendorId, status } : { vendorId },
    order: { updatedAt: 'DESC' },
  });
}

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

/**
 * Shallow-merges incoming `formDataJson` into the persisted JSON by section,
 * so a PUT carrying only `{ companyInfo: { … } }` does not clobber other
 * sections that were saved on an earlier step.
 */
export function mergeFormData(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...existing };
  for (const [section, value] of Object.entries(incoming)) {
    const prior = out[section];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      prior &&
      typeof prior === 'object' &&
      !Array.isArray(prior)
    ) {
      out[section] = {
        ...(prior as Record<string, unknown>),
        ...(value as Record<string, unknown>),
      };
    } else {
      out[section] = value;
    }
  }
  return out;
}

export async function updateDraft(
  submission: Submission,
  patch: { formDataJson?: Record<string, unknown>; currentStep?: number },
): Promise<Submission> {
  const repo = AppDataSource.getRepository(Submission);
  if (patch.formDataJson !== undefined) {
    submission.formDataJson = mergeFormData(submission.formDataJson ?? {}, patch.formDataJson);
  }
  if (typeof patch.currentStep === 'number') {
    submission.currentStep = patch.currentStep;
  }
  return repo.save(submission);
}
