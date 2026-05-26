import { Router, type Request, type Response } from 'express';
import { requireJwt, requireRole } from '../middleware/auth';
import { listAuditLogs } from '../services/audit-log.service';

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseInteger(value: unknown): number | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

const router = Router();

router.use(requireJwt);

/**
 * GET /api/audit-logs (admin-only)
 * Filters: submissionId substring, action exact, actorEmail substring,
 * dateFrom/dateTo (ISO-8601), limit (default 50, max 200), offset.
 */
router.get('/', requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const submissionId =
    typeof req.query.submissionId === 'string' ? req.query.submissionId : undefined;
  const action = typeof req.query.action === 'string' ? req.query.action : undefined;
  const actorEmail = typeof req.query.actorEmail === 'string' ? req.query.actorEmail : undefined;
  const dateFrom = parseDate(req.query.dateFrom);
  const dateTo = parseDate(req.query.dateTo);
  const limit = parseInteger(req.query.limit);
  const offset = parseInteger(req.query.offset);

  const result = await listAuditLogs({
    submissionId,
    action,
    actorEmail,
    dateFrom,
    dateTo,
    limit,
    offset,
  });
  res.status(200).json(result);
});

export default router;
