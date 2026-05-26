import {
  InvalidTransitionError,
  type StateAction,
  nextStatus,
} from '../services/submission-state-machine';
import type { SubmissionStatus } from '../entities/submission.entity';

describe('nextStatus (submission state machine)', () => {
  // Cases that must be allowed by the issue: Draft→In-Process,
  // Modification-Required→In-Process via submit, and the three decisions
  // out of In-Process.
  const allowed: Array<[SubmissionStatus, StateAction, SubmissionStatus]> = [
    ['Draft', 'submit', 'In-Process'],
    ['Modification-Required', 'submit', 'In-Process'],
    ['In-Process', 'approve', 'Completed'],
    ['In-Process', 'reject', 'Rejected'],
    ['In-Process', 'request-modification', 'Modification-Required'],
  ];

  for (const [from, action, to] of allowed) {
    it(`allows ${from} --${action}--> ${to}`, () => {
      expect(nextStatus(from, action)).toBe(to);
    });
  }

  // Representative forbidden transitions (we don't enumerate the full cross
  // product — these cover every "wrong source status" + "wrong action at the
  // right source status" case we care about).
  const forbidden: Array<[SubmissionStatus, StateAction]> = [
    ['Draft', 'approve'],
    ['Draft', 'reject'],
    ['Draft', 'request-modification'],
    ['In-Process', 'submit'],
    ['Completed', 'submit'],
    ['Completed', 'approve'],
    ['Completed', 'reject'],
    ['Rejected', 'submit'],
    ['Rejected', 'approve'],
    ['Modification-Required', 'approve'],
    ['Modification-Required', 'reject'],
  ];

  for (const [from, action] of forbidden) {
    it(`forbids ${from} --${action}-->`, () => {
      expect(() => nextStatus(from, action)).toThrow(InvalidTransitionError);
    });
  }

  it('InvalidTransitionError carries the from/action pair', () => {
    try {
      nextStatus('Completed', 'approve');
      fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidTransitionError);
      const e = err as InvalidTransitionError;
      expect(e.fromStatus).toBe('Completed');
      expect(e.action).toBe('approve');
    }
  });
});
