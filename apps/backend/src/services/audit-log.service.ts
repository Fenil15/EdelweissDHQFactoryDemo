import { AppDataSource } from '../db/data-source';
import { AuditLog } from '../entities/audit-log.entity';
import type { SubmissionStatus } from '../entities/submission.entity';
import type { StateAction } from './submission-state-machine';

export interface WriteTransitionInput {
  submissionId: string;
  fromStatus: SubmissionStatus | null;
  toStatus: SubmissionStatus | null;
  actorUserId: string;
  action: StateAction;
  comments?: string | null;
}

/**
 * Append-only insert of an AuditLog row. There are deliberately no update or
 * delete helpers in this module — callers cannot mutate or erase prior
 * transitions through the service layer.
 */
export async function writeTransition(input: WriteTransitionInput): Promise<AuditLog> {
  const repo = AppDataSource.getRepository(AuditLog);
  const row = repo.create({
    submissionId: input.submissionId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    actorUserId: input.actorUserId,
    action: input.action,
    comments: input.comments ?? null,
  });
  return repo.save(row);
}
