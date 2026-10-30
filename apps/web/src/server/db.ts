import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

// Um client por instancia da funcao: em dev o hot reload recriaria a cada edicao.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // ponytail: DATABASE_URL e o pooler do Supabase (modo transacao) em producao — serverless abre muitas conexoes curtas.
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
