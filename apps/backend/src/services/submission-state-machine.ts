import type { SubmissionStatus } from '../entities/submission.entity';

/**
 * Verbs the state machine understands. `submit` is the vendor-driven verb
 * (Draft|Modification-Required → In-Process); the remaining three are the
 * checker decisions out of In-Process.
 */
export type StateAction = 'submit' | 'approve' | 'reject' | 'request-modification';

/**
 * Thrown by `nextStatus` when an action is not allowed from the current
 * status. Route handlers should catch this and translate to HTTP 409.
 */
export class InvalidTransitionError extends Error {
  readonly fromStatus: SubmissionStatus;
  readonly action: StateAction;
  constructor(fromStatus: SubmissionStatus, action: StateAction) {
    super(`Cannot ${action} from status ${fromStatus}`);
    this.name = 'InvalidTransitionError';
    this.fromStatus = fromStatus;
    this.action = action;
  }
}

// Encoded as a from-keyed table of action→target. Anything missing is
// implicitly forbidden, which keeps the guard surface minimal and explicit.
const TRANSITIONS: Record<SubmissionStatus, Partial<Record<StateAction, SubmissionStatus>>> = {
  Draft: { submit: 'In-Process' },
  'Modification-Required': { submit: 'In-Process' },
  'In-Process': {
    approve: 'Completed',
    reject: 'Rejected',
    'request-modification': 'Modification-Required',
  },
  Completed: {},
  Rejected: {},
};

/**
 * Returns the target status for the given (from, action) pair, or throws
 * InvalidTransitionError. Pure function — does not touch the database.
 */
export function nextStatus(from: SubmissionStatus, action: StateAction): SubmissionStatus {
  const target = TRANSITIONS[from]?.[action];
  if (!target) {
    throw new InvalidTransitionError(from, action);
  }
  return target;
}
