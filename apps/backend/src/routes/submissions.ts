import { Router, type Request, type Response } from 'express';
import { requireJwt, requireRole } from '../middleware/auth';
import { Submission, type SubmissionStatus } from '../entities/submission.entity';
import {
  createDraftForVendor,
  findSubmissionOwnedBy,
  getOrCreateVendorForUser,
  listSubmissionsForVendor,
  updateDraft,
} from '../services/submission.service';
import { validateFormatFields } from '../services/format-validators';

const SUBMISSION_STATUSES: readonly SubmissionStatus[] = [
  'Draft',
  'In-Process',
  'Completed',
  'Rejected',
  'Modification-Required',
];

function parseStatusFilter(value: unknown): SubmissionStatus | undefined {
  if (typeof value !== 'string') return undefined;
  return (SUBMISSION_STATUSES as readonly string[]).includes(value)
    ? (value as SubmissionStatus)
    : undefined;
}

const router = Router();

router.use(requireJwt, requireRole('vendor'));

function serialize(s: Submission) {
  return {
    id: s.id,
    vendorId: s.vendorId,
    status: s.status,
    currentStep: s.currentStep,
    formDataJson: s.formDataJson,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const vendor = await getOrCreateVendorForUser(userId);
  const status = parseStatusFilter(req.query.status);
  const rows = await listSubmissionsForVendor(vendor.id, status);
  res.status(200).json(rows.map(serialize));
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  // requireJwt has already populated req.user; requireRole('vendor') has gated this.
  const userId = req.user!.userId;
  const vendor = await getOrCreateVendorForUser(userId);
  const submission = await createDraftForVendor(vendor.id);
  res.status(201).json(serialize(submission));
});

router.get('/:id', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const vendor = await getOrCreateVendorForUser(userId);
  const submission = await findSubmissionOwnedBy(req.params.id, vendor.id);
  if (!submission) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.status(200).json(serialize(submission));
});

router.put('/:id', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const vendor = await getOrCreateVendorForUser(userId);
  const submission = await findSubmissionOwnedBy(req.params.id, vendor.id);
  if (!submission) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  if (submission.status !== 'Draft') {
    res.status(409).json({ error: 'invalid_status' });
    return;
  }
  const body = (req.body ?? {}) as { formDataJson?: unknown; currentStep?: unknown };
  const formDataJson =
    body.formDataJson && typeof body.formDataJson === 'object' && !Array.isArray(body.formDataJson)
      ? (body.formDataJson as Record<string, unknown>)
      : undefined;
  if (formDataJson) {
    const errors = validateFormatFields(formDataJson);
    if (Object.keys(errors).length > 0) {
      res.status(400).json({ error: 'invalid_format', errors });
      return;
    }
  }
  const currentStep = typeof body.currentStep === 'number' ? body.currentStep : undefined;
  const updated = await updateDraft(submission, { formDataJson, currentStep });
  res.status(200).json(serialize(updated));
});

export default router;
