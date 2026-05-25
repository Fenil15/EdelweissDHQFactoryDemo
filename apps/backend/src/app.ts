import express, { type Express } from 'express';
import healthRouter from './routes/health';

export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/health', healthRouter);
  return app;
}
