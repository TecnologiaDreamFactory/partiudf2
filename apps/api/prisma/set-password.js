/**
 * Uso (na pasta apps/api): node prisma/set-password.js <email> <senha_numerica>
 * Ex.: node prisma/set-password.js driver@local 123456
 */
require('dotenv').config({ path: require('path').resolve(process.cwd(), '../../.env') });
require('dotenv').config();
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

const SALT_ROUNDS = 10;
/** Role ao criar usuário novo (4º arg opcional): DRIVER | PASSENGER | ADMIN */

const url = (process.env.DATABASE_URL ?? '').replace(/^mysql:\/\//, 'mariadb://');
const adapter = new PrismaMariaDb(url);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = (process.argv[2] ?? '').trim();
  const plain = (process.argv[3] ?? '').trim();
  const roleOnCreate = (process.argv[4] ?? 'DRIVER').trim().toUpperCase();
  if (!email || !plain) {
    console.error('Uso: node prisma/set-password.js <email> <senha> [role_se_novo=DRIVER]');
    process.exit(1);
  }
  if (!/^\d{4,8}$/.test(plain)) {
    console.error('A senha deve ter de 4 a 8 dígitos numéricos (regra do app).');
    process.exit(1);
  }

  const hash = await bcrypt.hash(plain, SALT_ROUNDS);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { password: hash },
    });
    console.log(`Senha atualizada para ${email}.`);
    return;
  }

  if (!['DRIVER', 'PASSENGER', 'ADMIN'].includes(roleOnCreate)) {
    console.error('role inválido; use DRIVER, PASSENGER ou ADMIN');
    process.exit(1);
  }

  await prisma.user.create({
    data: {
      email,
      password: hash,
      role: roleOnCreate,
    },
  });
  console.log(`Usuário criado: ${email} (${roleOnCreate}), senha definida.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
