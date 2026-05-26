import express, { type Express } from 'express';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import { documentsRouter, submissionDocumentsRouter } from './routes/documents';
import { ensureStorageRootExists } from './services/document.service';

export function createApp(): Express {
  ensureStorageRootExists();
  const app = express();
  app.use(express.json());
  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/submissions/:id/documents', submissionDocumentsRouter);
  app.use('/api/documents', documentsRouter);
  return app;
}
