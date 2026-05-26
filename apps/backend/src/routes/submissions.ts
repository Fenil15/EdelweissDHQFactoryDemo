import { Router, type Request, type Response } from 'express';
import { requireJwt, requireRole } from '../middleware/auth';
import { Submission, type SubmissionStatus } from '../entities/submission.entity';
import { AppDataSource } from '../db/data-source';
import {
  createDraftForVendor,
  findSubmissionOwnedBy,
  getOrCreateVendorForUser,
  listSubmissionsForVendor,
  updateDraft,
} from '../services/submission.service';
import { validateFormatFields } from '../services/format-validators';
import {
  InvalidTransitionError,
  type StateAction,
  nextStatus,
} from '../services/submission-state-machine';
import { writeTransition } from '../services/audit-log.service';
import { emailService } from '../services/email.service';

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

// Every endpoint requires a valid JWT. Role gating is per-route so that
// vendor-only routes (GET/PUT/POST draft, /submit) and checker-only routes
// (/decision) can live under the same mount.
router.use(requireJwt);

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

router.get('/', requireRole('vendor'), async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const vendor = await getOrCreateVendorForUser(userId);
  const status = parseStatusFilter(req.query.status);
  const rows = await listSubmissionsForVendor(vendor.id, status);
  res.status(200).json(rows.map(serialize));
});

router.post('/', requireRole('vendor'), async (req: Request, res: Response): Promise<void> => {
  // requireJwt has already populated req.user; requireRole('vendor') has gated this.
  const userId = req.user!.userId;
  const vendor = await getOrCreateVendorForUser(userId);
  const submission = await createDraftForVendor(vendor.id);
  res.status(201).json(serialize(submission));
});

router.get(
  '/:id',
  requireRole('vendor'),
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const vendor = await getOrCreateVendorForUser(userId);
    const submission = await findSubmissionOwnedBy(req.params.id, vendor.id);
    if (!submission) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.status(200).json(serialize(submission));
  },
);

router.put(
  '/:id',
  requireRole('vendor'),
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
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
      body.formDataJson &&
      typeof body.formDataJson === 'object' &&
      !Array.isArray(body.formDataJson)
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
  },
);

/**
 * POST /api/submissions/:id/submit
 * Vendor-only. Transitions Draft|Modification-Required → In-Process,
 * writes an AuditLog row, and notifies all checkers via the email service.
 */
router.post(
  '/:id/submit',
  requireRole('vendor'),
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const vendor = await getOrCreateVendorForUser(userId);
    const submission = await findSubmissionOwnedBy(req.params.id, vendor.id);
    if (!submission) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    let target: SubmissionStatus;
    try {
      target = nextStatus(submission.status, 'submit');
    } catch (err) {
      if (err instanceof InvalidTransitionError) {
        res.status(409).json({ error: 'invalid_transition', fromStatus: err.fromStatus });
        return;
      }
      throw err;
    }

    const fromStatus = submission.status;
    submission.status = target;
    await AppDataSource.getRepository(Submission).save(submission);

    await writeTransition({
      submissionId: submission.id,
      fromStatus,
      toStatus: target,
      actorUserId: userId,
      action: 'submit',
      comments: null,
    });

    await emailService.notifyCheckersOfNewSubmission(submission);

    res.status(200).json(serialize(submission));
  },
);

const DECISION_ACTIONS: readonly StateAction[] = ['approve', 'reject', 'request-modification'];

/**
 * POST /api/submissions/:id/decision
 * Checker/admin only. Body: { action, comments }. Transitions In-Process →
 * Completed|Rejected|Modification-Required, writes an AuditLog row, and
 * notifies the owning vendor via the email service.
 */
router.post(
  '/:id/decision',
  requireRole('checker', 'admin'),
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const body = (req.body ?? {}) as { action?: unknown; comments?: unknown };

    const action = body.action;
    if (typeof action !== 'string' || !(DECISION_ACTIONS as readonly string[]).includes(action)) {
      res.status(400).json({ error: 'invalid_action' });
      return;
    }
    const commentsRaw = body.comments;
    if (typeof commentsRaw !== 'string' || commentsRaw.trim().length === 0) {
      res.status(422).json({ error: 'comments_required' });
      return;
    }

    const submission = await AppDataSource.getRepository(Submission).findOneBy({
      id: req.params.id,
    });
    if (!submission) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    let target: SubmissionStatus;
    try {
      target = nextStatus(submission.status, action as StateAction);
    } catch (err) {
      if (err instanceof InvalidTransitionError) {
        res.status(409).json({ error: 'invalid_transition', fromStatus: err.fromStatus });
        return;
      }
      throw err;
    }

    const fromStatus = submission.status;
    submission.status = target;
    await AppDataSource.getRepository(Submission).save(submission);

    await writeTransition({
      submissionId: submission.id,
      fromStatus,
      toStatus: target,
      actorUserId: userId,
      action: action as StateAction,
      comments: commentsRaw,
    });

    await emailService.notifyVendorOfDecision(submission, action as StateAction, commentsRaw);

    res.status(200).json(serialize(submission));
  },
);

export default router;
