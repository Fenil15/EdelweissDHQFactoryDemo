import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../db/data-source';
import { User, type UserRole } from '../entities/user.entity';
import { emailService } from './email.service';

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes
const MAX_OTP_ATTEMPTS = 3;
const JWT_TTL = '24h';

function jwtSecret(): string {
  return process.env.JWT_SECRET ?? 'dev-secret-change-me';
}

function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

function generateOtp(): string {
  // 6 random decimal digits, leading-zero-padded
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function generateInvitationToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

export type VerifyOutcome =
  | { kind: 'ok'; token: string; role: UserRole; userId: string }
  | { kind: 'locked' }
  | { kind: 'invalid' };

export const authService = {
  async invite(email: string, role: UserRole): Promise<User> {
    const repo = AppDataSource.getRepository(User);
    const invitationToken = generateInvitationToken();
    const user = await repo.save({ email, role, invitationToken });
    emailService.sendInvitation(email, invitationToken);
    return user;
  },

  /**
   * Generates a fresh OTP for the user, stores its hash + 10-min expiry, and
   * resets the fail counter. To avoid leaking which emails are registered, we
   * silently no-op when the email is unknown.
   */
  async requestOtp(email: string): Promise<void> {
    const repo = AppDataSource.getRepository(User);
    const user = await repo.findOneBy({ email });
    if (!user) return;
    const otp = generateOtp();
    user.otpHash = hashOtp(otp);
    user.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
    user.otpFailCount = 0;
    user.lockedUntil = null;
    await repo.save(user);
    emailService.sendOtp(email, otp);
  },

  async verifyOtp(email: string, otp: string): Promise<VerifyOutcome> {
    const repo = AppDataSource.getRepository(User);
    const user = await repo.findOneBy({ email });
    if (!user || !user.otpHash || !user.otpExpiresAt) {
      return { kind: 'invalid' };
    }

    // Honour an existing lockout regardless of OTP value.
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      return { kind: 'locked' };
    }

    if (user.otpExpiresAt.getTime() < Date.now()) {
      return { kind: 'invalid' };
    }

    const presented = hashOtp(otp);
    const match =
      presented.length === user.otpHash.length &&
      crypto.timingSafeEqual(Buffer.from(presented), Buffer.from(user.otpHash));

    if (!match) {
      user.otpFailCount = (user.otpFailCount ?? 0) + 1;
      if (user.otpFailCount >= MAX_OTP_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + LOCKOUT_MS);
        await repo.save(user);
        return { kind: 'locked' };
      }
      await repo.save(user);
      return { kind: 'invalid' };
    }

    // Success — clear OTP state and mint a token.
    user.otpHash = null;
    user.otpExpiresAt = null;
    user.otpFailCount = 0;
    user.lockedUntil = null;
    await repo.save(user);

    const token = jwt.sign({ userId: user.id, role: user.role }, jwtSecret(), {
      expiresIn: JWT_TTL,
    });
    return { kind: 'ok', token, role: user.role, userId: user.id };
  },
};
