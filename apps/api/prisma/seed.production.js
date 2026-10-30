/**
 * Seed para produção: pickup points + 1 admin
 * Uso: pnpm prisma:seed:prod (ou node prisma/seed.production.js)
 */
require('dotenv').config({ path: require('path').resolve(process.cwd(), '../../.env') });
require('dotenv').config();
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

const url = (process.env.DATABASE_URL ?? '').replace(/^mysql:\/\//, 'mariadb://');
const adapter = new PrismaMariaDb(url);
const prisma = new PrismaClient({ adapter });

const SALT_ROUNDS = 10;
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error(
    'Defina SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD no ambiente antes de rodar o seed de produção.',
  );
}

async function hashPw(pw) {
  return bcrypt.hash(pw, SALT_ROUNDS);
}

async function main() {
  // Admin único para produção
  const pwAdmin = await hashPw(ADMIN_PASSWORD);
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { password: pwAdmin },
    create: {
      email: ADMIN_EMAIL,
      password: pwAdmin,
      role: 'ADMIN',
    },
  });

  // Pickup points (mesmos do ambiente local)
  await prisma.pickupPoint.deleteMany({});
  await prisma.pickupPoint.createMany({
    data: [
      { code: 'METRO_CINELANDIA_A', name: 'Metrô Cinelândia A', lat: -22.912001, lng: -43.175761, address: 'Centro' },
      { code: 'METRO_CINELANDIA_B', name: 'Metrô Cinelândia B', lat: -23.5615, lng: -46.7314, address: 'Zona Oeste' },
      { code: 'ESTACIONAMENTO_GLORIA', name: 'Estacionamento Glória', lat: -22.92216, lng: -43.17206, address: 'Glória' },
      { code: 'PONTO_C', name: 'Ponto C', lat: -23.5489, lng: -46.6388, address: 'Zona Sul' },
    ],
  });

  console.log('Seed produção OK:', { admin: admin.email });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
