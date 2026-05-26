import fs from 'fs';
import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { AppDataSource } from '../db/data-source';
import { Document } from '../entities/document.entity';
import { requireJwt } from '../middleware/auth';
import {
  MAX_FILE_SIZE_BYTES,
  checkSubmissionAccess,
  loadDocumentForActor,
  persistUpload,
  toDocumentDto,
} from '../services/document.service';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

/**
 * Multer single-file middleware that translates a size-limit error into a 413
 * JSON response. Anything else bubbles via next(err).
 */
function uploadSingle(field: string) {
  const mw = upload.single(field);
  return (req: Request, res: Response, next: NextFunction): void => {
    mw(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(413).json({ error: 'file_too_large' });
          return;
        }
        res.status(400).json({ error: 'upload_error', detail: err.code });
        return;
      }
      if (err) {
        next(err);
        return;
      }
      next();
    });
  };
}

// Routes mounted under /api/submissions/:id/documents
export const submissionDocumentsRouter = Router({ mergeParams: true });

submissionDocumentsRouter.post(
  '/',
  requireJwt,
  uploadSingle('file'),
  async (req: Request, res: Response): Promise<void> => {
    const submissionId = String(req.params.id);
    if (!req.user) {
      res.status(401).json({ error: 'missing_token' });
      return;
    }
    const access = await checkSubmissionAccess(submissionId, req.user.userId, req.user.role);
    if (access.kind === 'not_found') {
      res.status(404).json({ error: 'submission_not_found' });
      return;
    }
    if (access.kind === 'forbidden') {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'file_required' });
      return;
    }
    const outcome = await persistUpload(submissionId, {
      buffer: req.file.buffer,
      declaredMime: req.file.mimetype,
      originalName: req.file.originalname,
    });
    if (outcome.kind === 'too_large') {
      res.status(413).json({ error: 'file_too_large' });
      return;
    }
    if (outcome.kind === 'unsupported_media_type') {
      res.status(415).json({ error: 'unsupported_media_type' });
      return;
    }
    res.status(201).json(toDocumentDto(outcome.document));
  },
);

submissionDocumentsRouter.get(
  '/',
  requireJwt,
  async (req: Request, res: Response): Promise<void> => {
    const submissionId = String(req.params.id);
    if (!req.user) {
      res.status(401).json({ error: 'missing_token' });
      return;
    }
    const access = await checkSubmissionAccess(submissionId, req.user.userId, req.user.role);
    if (access.kind === 'not_found') {
      res.status(404).json({ error: 'submission_not_found' });
      return;
    }
    if (access.kind === 'forbidden') {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    const docs = await AppDataSource.getRepository(Document).find({
      where: { submissionId },
      order: { uploadedAt: 'ASC' },
    });
    res.status(200).json(docs.map(toDocumentDto));
  },
);

// Routes mounted under /api/documents
export const documentsRouter = Router();

documentsRouter.get(
  '/:id',
  requireJwt,
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'missing_token' });
      return;
    }
    const outcome = await loadDocumentForActor(
      String(req.params.id),
      req.user.userId,
      req.user.role,
    );
    if (outcome.kind === 'not_found') {
      res.status(404).json({ error: 'document_not_found' });
      return;
    }
    if (outcome.kind === 'forbidden') {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    const { document } = outcome.data;
    if (!fs.existsSync(document.storagePath)) {
      res.status(404).json({ error: 'document_file_missing' });
      return;
    }
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Length', document.sizeBytes.toString());
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(document.fileName)}"`,
    );
    const stream = fs.createReadStream(document.storagePath);
    stream.on('error', () => {
      if (!res.headersSent) res.status(500).end();
      else res.end();
    });
    stream.pipe(res);
  },
);

documentsRouter.delete(
  '/:id',
  requireJwt,
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'missing_token' });
      return;
    }
    const outcome = await loadDocumentForActor(
      String(req.params.id),
      req.user.userId,
      req.user.role,
    );
    if (outcome.kind === 'not_found') {
      res.status(404).json({ error: 'document_not_found' });
      return;
    }
    if (outcome.kind === 'forbidden') {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    const { document, submission } = outcome.data;
    if (submission.status !== 'Draft') {
      res.status(409).json({ error: 'submission_not_draft' });
      return;
    }
    await AppDataSource.getRepository(Document).delete({ id: document.id });
    try {
      fs.unlinkSync(document.storagePath);
    } catch (err) {
      // Best-effort cleanup — log and proceed. ENOENT is fine.
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        console.warn(`[documents] failed to unlink ${document.storagePath}:`, err);
      }
    }
    res.status(204).end();
  },
);
