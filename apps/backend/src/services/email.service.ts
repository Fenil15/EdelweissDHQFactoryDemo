import { AppDataSource } from '../db/data-source';
import { User } from '../entities/user.entity';
import { Vendor } from '../entities/vendor.entity';
import type { Submission } from '../entities/submission.entity';
import type { StateAction } from './submission-state-machine';

/**
 * Mock email sender. In a real POC we'd plug in nodemailer or an HTTP API;
 * here we just log to console so a developer can copy the OTP/token out of
 * the server log during testing. The transition helpers (`notify…`) are used
 * by the state-machine endpoints to fan-out notifications on submit and
 * decision events.
 */
export const emailService = {
  sendOtp(to: string, otp: string): void {
    console.log(`[EMAIL] To: ${to} OTP: ${otp}`);
  },
  sendInvitation(to: string, invitationToken: string): void {
    console.log(`[EMAIL] To: ${to} INVITE_TOKEN: ${invitationToken}`);
  },

  /**
   * Console-emit one `[EMAIL]` line per active checker. Called by
   * POST /api/submissions/:id/submit on Draft|Modification-Required → In-Process.
   */
  async notifyCheckersOfNewSubmission(submission: Submission): Promise<void> {
    const checkers = await AppDataSource.getRepository(User).findBy({ role: 'checker' });
    for (const checker of checkers) {
      console.log(
        `[EMAIL] to=${checker.email} subject=submission-submitted body=submissionId=${submission.id} status=${submission.status}`,
      );
    }
  },

  /**
   * Console-emit a single `[EMAIL]` line to the vendor that owns the
   * submission, summarising the checker decision. Called by
   * POST /api/submissions/:id/decision after the status update is persisted.
   */
  async notifyVendorOfDecision(
    submission: Submission,
    action: StateAction,
    comments: string,
  ): Promise<void> {
    const vendor = await AppDataSource.getRepository(Vendor).findOneBy({ id: submission.vendorId });
    if (!vendor) return;
    const user = await AppDataSource.getRepository(User).findOneBy({ id: vendor.userId });
    if (!user) return;
    console.log(
      `[EMAIL] to=${user.email} subject=submission-decision body=submissionId=${submission.id} status=${submission.status} action=${action} comments=${comments}`,
    );
  },
};
