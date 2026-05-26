import { AppDataSource } from '../db/data-source';
import { User } from '../entities/user.entity';
import { Vendor } from '../entities/vendor.entity';
import { Submission } from '../entities/submission.entity';
import { emailService } from '../services/email.service';

describe('emailService transition helpers', () => {
  beforeAll(async () => {
    await AppDataSource.initialize();
  });
  afterAll(async () => {
    await AppDataSource.destroy();
  });
  beforeEach(async () => {
    await AppDataSource.synchronize(true);
  });

  async function seedVendorWithSubmission(): Promise<{
    submission: Submission;
    vendorEmail: string;
  }> {
    const user = await AppDataSource.getRepository(User).save({
      email: 'vendor@example.com',
      role: 'vendor',
    });
    const vendor = await AppDataSource.getRepository(Vendor).save({
      userId: user.id,
      companyName: 'Acme',
    });
    const submission = await AppDataSource.getRepository(Submission).save({
      vendorId: vendor.id,
      status: 'In-Process',
    });
    return { submission, vendorEmail: user.email };
  }

  describe('notifyCheckersOfNewSubmission', () => {
    it('logs one EMAIL line per checker, mentioning the submission id', async () => {
      const userRepo = AppDataSource.getRepository(User);
      await userRepo.save({ email: 'c1@example.com', role: 'checker' });
      await userRepo.save({ email: 'c2@example.com', role: 'checker' });
      // Vendor must NOT receive a checker notification.
      const { submission } = await seedVendorWithSubmission();

      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      let lines: string[];
      try {
        await emailService.notifyCheckersOfNewSubmission(submission);
        lines = spy.mock.calls.map((c) => String(c[0]));
      } finally {
        spy.mockRestore();
      }
      const emailLines = lines.filter((l) => l.startsWith('[EMAIL] '));
      expect(emailLines).toHaveLength(2);
      const recipients = emailLines.map((l) => l.match(/to=(\S+)/)?.[1]);
      expect(recipients.sort()).toEqual(['c1@example.com', 'c2@example.com']);
      for (const line of emailLines) {
        expect(line).toContain(`submissionId=${submission.id}`);
      }
    });

    it('emits nothing when there are no checkers', async () => {
      const { submission } = await seedVendorWithSubmission();
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      let lines: string[];
      try {
        await emailService.notifyCheckersOfNewSubmission(submission);
        lines = spy.mock.calls.map((c) => String(c[0]));
      } finally {
        spy.mockRestore();
      }
      const emailLines = lines.filter((l) => l.startsWith('[EMAIL] '));
      expect(emailLines).toHaveLength(0);
    });
  });

  describe('notifyVendorOfDecision', () => {
    it('logs an EMAIL line to the vendor email containing status and comments', async () => {
      const { submission, vendorEmail } = await seedVendorWithSubmission();

      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      let lines: string[];
      try {
        await emailService.notifyVendorOfDecision(submission, 'approve', 'Looks good');
        lines = spy.mock.calls.map((c) => String(c[0]));
      } finally {
        spy.mockRestore();
      }
      const line = lines.find((l) => l.startsWith('[EMAIL] '));
      expect(line).toBeDefined();
      expect(line).toContain(`to=${vendorEmail}`);
      expect(line).toContain(`submissionId=${submission.id}`);
      // The submission row's current status is reported (the route updates it
      // before calling the email helper).
      expect(line).toContain('status=In-Process');
      expect(line).toContain('action=approve');
      expect(line).toContain('Looks good');
    });
  });
});
