import { Router, type Request, type Response } from 'express';
import { authService } from '../services/auth.service';
import { requireJwt, requireRole } from '../middleware/auth';
import type { UserRole } from '../entities/user.entity';

const router = Router();

const ALLOWED_ROLES: UserRole[] = ['vendor', 'checker', 'admin'];

router.post(
  '/invite',
  requireJwt,
  requireRole('admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { email, role } = req.body ?? {};
    if (typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'invalid_email' });
      return;
    }
    if (!ALLOWED_ROLES.includes(role)) {
      res.status(400).json({ error: 'invalid_role' });
      return;
    }
    try {
      const user = await authService.invite(email, role as UserRole);
      res.status(201).json({ id: user.id, email: user.email, role: user.role });
    } catch {
      res.status(409).json({ error: 'email_already_exists' });
    }
  },
);

router.post('/request-otp', async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body ?? {};
  if (typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'invalid_email' });
    return;
  }
  await authService.requestOtp(email);
  // Always 200 — don't leak which emails are registered.
  res.status(200).json({ ok: true });
});

router.post('/verify-otp', async (req: Request, res: Response): Promise<void> => {
  const { email, otp } = req.body ?? {};
  if (typeof email !== 'string' || typeof otp !== 'string') {
    res.status(400).json({ error: 'invalid_request' });
    return;
  }
  const outcome = await authService.verifyOtp(email, otp);
  switch (outcome.kind) {
    case 'ok':
      res.status(200).json({ token: outcome.token, role: outcome.role, userId: outcome.userId });
      return;
    case 'locked':
      res.status(423).json({ error: 'locked' });
      return;
    case 'invalid':
      res.status(401).json({ error: 'invalid_otp' });
      return;
  }
});

export default router;
