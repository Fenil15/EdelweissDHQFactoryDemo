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
 * Cross-vendor filter shape used by the checker / admin dashboards. Every
 * field is optional. The query is intentionally narrow — POC scope.
 */
export interface SubmissionListFilters {
  statuses?: SubmissionStatus[];
  vendorName?: string;
  submissionId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Cross-vendor list for checker / admin role. Joins the Vendor row so the
 * UI can show company name without an N+1, and applies the optional filter
 * predicates against status, vendor name, submission id and createdAt range.
 */
export async function listSubmissionsForAllVendors(
  filters: SubmissionListFilters,
): Promise<Array<Submission & { vendorName: string | null }>> {
  const repo = AppDataSource.getRepository(Submission);
  const qb = repo
    .createQueryBuilder('s')
    .leftJoin(Vendor, 'v', 'v.id = s.vendorId')
    .addSelect('v.companyName', 's_vendorName')
    .orderBy('s.updatedAt', 'DESC');

  if (filters.statuses && filters.statuses.length > 0) {
    qb.andWhere('s.status IN (:...statuses)', { statuses: filters.statuses });
  }
  if (filters.vendorName && filters.vendorName.trim().length > 0) {
    qb.andWhere('LOWER(v.companyName) LIKE :vendorName', {
      vendorName: `%${filters.vendorName.trim().toLowerCase()}%`,
    });
  }
  if (filters.submissionId && filters.submissionId.trim().length > 0) {
    qb.andWhere('CAST(s.id AS TEXT) LIKE :sid', {
      sid: `%${filters.submissionId.trim().toLowerCase()}%`,
    });
  }
  if (filters.dateFrom) {
    qb.andWhere('s.createdAt >= :dateFrom', { dateFrom: filters.dateFrom });
  }
  if (filters.dateTo) {
    qb.andWhere('s.createdAt <= :dateTo', { dateTo: filters.dateTo });
  }

  const rows = await qb.getRawAndEntities();
  return rows.entities.map((entity, idx) => {
    const raw = rows.raw[idx] as { s_vendorName?: string | null };
    return Object.assign(entity, { vendorName: raw?.s_vendorName ?? null });
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
