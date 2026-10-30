import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Mesmo arquivo que o Next le em dev; na Vercel as variaveis ja vem do ambiente.
config({ path: '.env.local' });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  // Migrations usam a conexao direta (DIRECT_URL); o pooler em modo transacao nao serve para DDL.
  datasource: { url: env('DIRECT_URL') },
  migrations: { seed: 'tsx prisma/seed.ts' },
});
