/**
 * Troca a senha de um usuario.
 *   pnpm --filter @partiudf/web db:set-password admin@local trocar123
 */
import { config } from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { isValidPassword, PASSWORD_RULE } from '../src/lib/auth/password';

config({ path: '.env.local' });

const [email, password] = process.argv.slice(2);
if (!email || !isValidPassword(password ?? '')) {
  console.error(`Uso: db:set-password <email> <senha> (${PASSWORD_RULE.toLowerCase()})`);
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

prisma.user
  .update({ where: { email }, data: { password: await bcrypt.hash(password, 10) } })
  .then(() => console.log(`Senha de ${email} atualizada.`))
  .catch((e) => {
    console.error(e.code === 'P2025' ? `Usuário ${email} não encontrado.` : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
