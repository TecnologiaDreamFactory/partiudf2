import * as dotenv from 'dotenv';
import * as path from 'path';

// Carrega .env da raiz do monorepo
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config(); // fallback apps/api/.env
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    seed: 'node prisma/seed.js',
  },
});
