import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AppDataSource } from '../db/data-source';
import { Document } from '../entities/document.entity';
import { Submission } from '../entities/submission.entity';
import { Vendor } from '../entities/vendor.entity';
import type { UserRole } from '../entities/user.entity';

export const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const EXT_BY_MIME: Record<AllowedMimeType, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

/** Inspect the first bytes of the buffer and return the detected MIME, or null. */
export function sniffMime(buf: Buffer): AllowedMimeType | null {
  if (buf.length >= 5 && buf.slice(0, 5).toString('ascii') === '%PDF-') {
    return 'application/pdf';
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  return null;
}

export function storageRoot(): string {
  return process.env.STORAGE_DIR ?? './uploads';
}

export function ensureStorageRootExists(): void {
  const root = storageRoot();
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }
}

export type OwnershipCheck =
  | { kind: 'ok' }
  | { kind: 'not_found' }
  | { kind: 'forbidden' };

/**
 * Returns whether the actor (identified by userId+role) is allowed to act on
 * a submission. Vendors must be the owning vendor (Vendor.userId === actor).
 * Checkers and admins are allowed on any submission.
 */
export async function checkSubmissionAccess(
  submissionId: string,
  actorUserId: string,
  actorRole: UserRole,
): Promise<OwnershipCheck> {
  const sub = await AppDataSource.getRepository(Submission).findOneBy({ id: submissionId });
  if (!sub) return { kind: 'not_found' };
  if (actorRole === 'checker' || actorRole === 'admin') return { kind: 'ok' };
  // Vendor: their User.id must be the userId of the Vendor row whose id == submission.vendorId.
  const vendor = await AppDataSource.getRepository(Vendor).findOneBy({ id: sub.vendorId });
  if (!vendor) return { kind: 'not_found' };
  if (vendor.userId !== actorUserId) return { kind: 'forbidden' };
  return { kind: 'ok' };
}

export interface UploadedFileInput {
  buffer: Buffer;
  declaredMime: string;
  originalName: string;
}

export type UploadOutcome =
  | { kind: 'unsupported_media_type' }
  | { kind: 'too_large' }
  | { kind: 'ok'; document: Document };

/**
 * Validates MIME/size, writes file to disk under STORAGE_DIR/<submissionId>/,
 * and persists the Document row. The caller is responsible for ensuring the
 * submission exists and the actor is authorised.
 */
export async function persistUpload(
  submissionId: string,
  file: UploadedFileInput,
): Promise<UploadOutcome> {
  if (file.buffer.length > MAX_FILE_SIZE_BYTES) {
    return { kind: 'too_large' };
  }

  const sniffed = sniffMime(file.buffer);
  if (!sniffed) return { kind: 'unsupported_media_type' };

  // Declared MIME must agree with what's actually in the bytes. Allow application/octet-stream
  // to be overridden by sniff result, but if declaredMime is in our allow-list it must match
  // the sniff.
  if (
    ALLOWED_MIME_TYPES.includes(file.declaredMime as AllowedMimeType) &&
    file.declaredMime !== sniffed
  ) {
    return { kind: 'unsupported_media_type' };
  }

  const docId = crypto.randomUUID();
  const ext = EXT_BY_MIME[sniffed];
  const subDir = path.join(storageRoot(), submissionId);
  fs.mkdirSync(subDir, { recursive: true });
  const storagePath = path.join(subDir, `${docId}.${ext}`);
  fs.writeFileSync(storagePath, file.buffer);

  const repo = AppDataSource.getRepository(Document);
  const row = repo.create({
    id: docId,
    submissionId,
    fileName: file.originalName,
    mimeType: sniffed,
    sizeBytes: file.buffer.length,
    storagePath,
  });
  await repo.save(row);
  return { kind: 'ok', document: row };
}

export interface DocumentAccessResult {
  document: Document;
  submission: Submission;
}

export type DocumentAccessOutcome =
  | { kind: 'ok'; data: DocumentAccessResult }
  | { kind: 'not_found' }
  | { kind: 'forbidden' };

/** Load a document + its submission and ensure the actor is allowed to access it. */
export async function loadDocumentForActor(
  documentId: string,
  actorUserId: string,
  actorRole: UserRole,
): Promise<DocumentAccessOutcome> {
  const doc = await AppDataSource.getRepository(Document).findOneBy({ id: documentId });
  if (!doc) return { kind: 'not_found' };
  const sub = await AppDataSource.getRepository(Submission).findOneBy({ id: doc.submissionId });
  if (!sub) return { kind: 'not_found' };
  if (actorRole !== 'checker' && actorRole !== 'admin') {
    const vendor = await AppDataSource.getRepository(Vendor).findOneBy({ id: sub.vendorId });
    if (!vendor || vendor.userId !== actorUserId) return { kind: 'forbidden' };
  }
  return { kind: 'ok', data: { document: doc, submission: sub } };
}

export function toDocumentDto(doc: Document): {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
} {
  return {
    id: doc.id,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    uploadedAt: doc.uploadedAt,
  };
}
