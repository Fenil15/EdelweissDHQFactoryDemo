import express, { type Express } from 'express';
import healthRouter from './routes/health';
import authRouter from './routes/auth';

export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  return app;
}
