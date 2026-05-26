import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRole } from '../entities/user.entity';

export interface AuthClaims {
  userId: string;
  role: UserRole;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthClaims;
  }
}

function jwtSecret(): string {
  return process.env.JWT_SECRET ?? 'dev-secret-change-me';
}

/**
 * Reads `Authorization: Bearer <token>`. On success attaches `req.user` and
 * calls next(); on failure responds 401.
 */
export function requireJwt(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    res.status(401).json({ error: 'missing_token' });
    return;
  }
  try {
    const decoded = jwt.verify(m[1], jwtSecret()) as AuthClaims;
    if (!decoded?.userId || !decoded?.role) {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }
    req.user = { userId: decoded.userId, role: decoded.role };
    next();
  } catch {
    res.status(401).json({ error: 'invalid_token' });
  }
}

/**
 * Factory: `requireRole('admin', 'checker')` builds a middleware that 403s
 * when the JWT claim's role is not in the allow-list. Must be mounted after
 * `requireJwt`.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'missing_token' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    next();
  };
}
