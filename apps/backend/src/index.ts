import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();
import { AppDataSource } from './db/data-source';
import { createApp } from './app';

const PORT = Number(process.env.PORT ?? 3000);

async function main(): Promise<void> {
  await AppDataSource.initialize();
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`[backend] listening on :${PORT}`);
  });
}

main().catch((err) => {
  console.error('[backend] fatal:', err);
  process.exit(1);
});
