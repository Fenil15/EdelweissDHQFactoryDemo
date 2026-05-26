import { Router, type Request, type Response } from 'express';
import { requireJwt, requireRole } from '../middleware/auth';
import { Submission } from '../entities/submission.entity';
import {
  createDraftForVendor,
  findSubmissionOwnedBy,
  getOrCreateVendorForUser,
} from '../services/submission.service';

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

export default router;
