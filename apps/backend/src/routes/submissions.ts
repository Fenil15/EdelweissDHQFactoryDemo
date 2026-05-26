import { Router, type Request, type Response } from 'express';
import { requireJwt, requireRole } from '../middleware/auth';
import { createDraftForVendor, getOrCreateVendorForUser } from '../services/submission.service';

const router = Router();

router.use(requireJwt, requireRole('vendor'));

router.post('/', async (req: Request, res: Response): Promise<void> => {
  // requireJwt has already populated req.user; requireRole('vendor') has gated this.
  const userId = req.user!.userId;
  const vendor = await getOrCreateVendorForUser(userId);
  const submission = await createDraftForVendor(vendor.id);
  res.status(201).json({
    id: submission.id,
    vendorId: submission.vendorId,
    status: submission.status,
    currentStep: submission.currentStep,
    formDataJson: submission.formDataJson,
    createdAt: submission.createdAt,
    updatedAt: submission.updatedAt,
  });
});

export default router;
