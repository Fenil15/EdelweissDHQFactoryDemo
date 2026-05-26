import { AppDataSource } from '../db/data-source';
import { AuditLog } from '../entities/audit-log.entity';
import type { SubmissionStatus } from '../entities/submission.entity';
import { User } from '../entities/user.entity';
import type { StateAction } from './submission-state-machine';

/**
 * Shape returned to the API surface: audit row enriched with the actor's
 * email so the UI can render "who" without a follow-up fetch.
 */
export interface AuditLogDto {
  id: string;
  submissionId: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  comments: string | null;
  actorUserId: string;
  actorEmail: string | null;
  createdAt: Date;
}

function toDto(log: AuditLog, email: string | null): AuditLogDto {
  return {
    id: log.id,
    submissionId: log.submissionId,
    action: log.action,
    fromStatus: log.fromStatus,
    toStatus: log.toStatus,
    comments: log.comments,
    actorUserId: log.actorUserId,
    actorEmail: email,
    createdAt: log.createdAt,
  };
}

/** Return the audit trail for a single submission, chronological order. */
export async function listAuditTrailForSubmission(submissionId: string): Promise<AuditLogDto[]> {
  const repo = AppDataSource.getRepository(AuditLog);
  const rows = await repo.find({
    where: { submissionId },
    order: { createdAt: 'ASC' },
  });
  if (rows.length === 0) return [];
  const actorIds = Array.from(new Set(rows.map((r) => r.actorUserId)));
  const users = await AppDataSource.getRepository(User).findByIds(actorIds);
  const emailById = new Map(users.map((u) => [u.id, u.email]));
  return rows.map((r) => toDto(r, emailById.get(r.actorUserId) ?? null));
}

export interface AuditLogListFilters {
  submissionId?: string;
  action?: string;
  actorEmail?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditLogListResult {
  rows: AuditLogDto[];
  total: number;
}

/**
 * Admin audit-log viewer query. Supports substring filters on submissionId
 * and actor email, exact match on action, an inclusive createdAt range, plus
 * limit/offset pagination (default 50, max 200).
 */
export async function listAuditLogs(filters: AuditLogListFilters): Promise<AuditLogListResult> {
  const repo = AppDataSource.getRepository(AuditLog);
  const qb = repo
    .createQueryBuilder('a')
    .leftJoin(User, 'u', 'u.id = a.actorUserId')
    .addSelect('u.email', 'a_actorEmail')
    .orderBy('a.createdAt', 'DESC');

  if (filters.submissionId && filters.submissionId.trim().length > 0) {
    qb.andWhere('CAST(a.submissionId AS TEXT) LIKE :sid', {
      sid: `%${filters.submissionId.trim().toLowerCase()}%`,
    });
  }
  if (filters.action && filters.action.trim().length > 0) {
    qb.andWhere('a.action = :action', { action: filters.action.trim() });
  }
  if (filters.actorEmail && filters.actorEmail.trim().length > 0) {
    qb.andWhere('LOWER(u.email) LIKE :email', {
      email: `%${filters.actorEmail.trim().toLowerCase()}%`,
    });
  }
  if (filters.dateFrom) {
    qb.andWhere('a.createdAt >= :dateFrom', { dateFrom: filters.dateFrom });
  }
  if (filters.dateTo) {
    qb.andWhere('a.createdAt <= :dateTo', { dateTo: filters.dateTo });
  }

  const total = await qb.getCount();
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);
  qb.limit(limit).offset(offset);
  const result = await qb.getRawAndEntities();
  const rows = result.entities.map((entity, idx) => {
    const raw = result.raw[idx] as { a_actorEmail?: string | null };
    return toDto(entity, raw?.a_actorEmail ?? null);
  });
  return { rows, total };
}

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
