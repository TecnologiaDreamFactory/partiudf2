require('dotenv').config({ path: require('path').resolve(process.cwd(), '../../.env') });
require('dotenv').config();
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

const url = (process.env.DATABASE_URL ?? '').replace(/^mysql:\/\//, 'mariadb://');
const adapter = new PrismaMariaDb(url);
const prisma = new PrismaClient({ adapter });

const SALT_ROUNDS = 10;
const isDev = process.env.NODE_ENV === 'development';

async function hashPw(pw) {
  return bcrypt.hash(pw, SALT_ROUNDS);
}

async function main() {
  if (!isDev) {
    console.log('Seed: skipping user creation (NODE_ENV !== development). Run with NODE_ENV=development to seed users.');
  }

  let admin;
  let driver;
  let p1;
  let p2;

  if (isDev) {
    const adminPw = process.env.SEED_ADMIN_PASSWORD || '1234';
    const devPw = process.env.SEED_DEV_PASSWORD || '123456';
    const pwAdmin = await hashPw(adminPw);
    const pwDev = await hashPw(devPw);

    admin = await prisma.user.upsert({
      where: { email: 'admin@local' },
      update: { password: pwAdmin },
      create: {
        email: 'admin@local',
        password: pwAdmin,
        role: 'ADMIN',
      },
    });

    driver = await prisma.user.upsert({
      where: { email: 'driver@local' },
      update: { password: pwDev },
      create: {
        email: 'driver@local',
        password: pwDev,
        role: 'DRIVER',
      },
    });
    p1 = await prisma.user.upsert({
      where: { email: 'p1@local' },
      update: { password: pwDev },
      create: {
        email: 'p1@local',
        password: pwDev,
        role: 'PASSENGER',
      },
    });
    p2 = await prisma.user.upsert({
      where: { email: 'p2@local' },
      update: { password: pwDev },
      create: {
        email: 'p2@local',
        password: pwDev,
        role: 'PASSENGER',
      },
    });
  }

  // Pickup points (lat/lng placeholders)
  // Deletar na ordem correta (Checkin referencia PickupPoint)
  await prisma.checkin.deleteMany({});
  await prisma.pickupPoint.deleteMany({});
  await prisma.pickupPoint.createMany({
    data: [
      { code: 'METRO_CINELANDIA_A', name: 'Metrô Cinelândia A', lat: -22.912001, lng: -43.175761, address: 'Centro' },
      { code: 'METRO_CINELANDIA_B', name: 'Metrô Cinelândia B', lat: -23.5615, lng: -46.7314, address: 'Zona Oeste' },
      { code: 'ESTACIONAMENTO_GLORIA', name: 'Estacionamento Glória', lat: -22.92216, lng: -43.17206, address: 'Glória' },
      { code: 'PONTO_C', name: 'Ponto C', lat: -23.5489, lng: -46.6388, address: 'Zona Sul' },
    ],
  });

  if (isDev) {
    console.log('Seed OK:', { driver: driver.email, p1: p1.email, p2: p2.email, admin: admin.email });
  } else {
    console.log('Seed OK (pickup points only)');
  }
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
