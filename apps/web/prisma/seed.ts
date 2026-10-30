/**
 * Seed: pontos de embarque + admin (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD).
 * Com NODE_ENV=development cria tambem motorista e passageiros de teste.
 *
 *   pnpm --filter @partiudf/web db:seed
 */
import { config } from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type UserRole } from '../src/generated/prisma/client';

config({ path: '.env.local' });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

const PICKUP_POINTS = [
  { code: 'METRO_CINELANDIA_A', name: 'Metrô Cinelândia A', lat: -22.912001, lng: -43.175761, address: 'Centro' },
  { code: 'METRO_CINELANDIA_B', name: 'Metrô Cinelândia B', lat: -23.5615, lng: -46.7314, address: 'Zona Oeste' },
  { code: 'ESTACIONAMENTO_GLORIA', name: 'Estacionamento Glória', lat: -22.92216, lng: -43.17206, address: 'Glória' },
  { code: 'PONTO_C', name: 'Ponto C', lat: -23.5489, lng: -46.6388, address: 'Zona Sul' },
];

async function upsertUser(email: string, password: string, role: UserRole) {
  const hash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({ where: { email }, update: { password: hash }, create: { email, password: hash, role } });
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !/^\d{4,8}$/.test(adminPassword ?? '')) {
    throw new Error('Defina SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD (4 a 8 dígitos) antes do seed.');
  }
  await upsertUser(adminEmail, adminPassword!, 'ADMIN');

  // Pontos: so cria os que faltam (nao apaga check-ins existentes).
  for (const p of PICKUP_POINTS) {
    await prisma.pickupPoint.upsert({ where: { code: p.code }, update: {}, create: p });
  }

  if (process.env.NODE_ENV === 'development') {
    const devPw = process.env.SEED_DEV_PASSWORD || '123456';
    await upsertUser('driver@local', devPw, 'DRIVER');
    await upsertUser('p1@local', devPw, 'PASSENGER');
    await upsertUser('p2@local', devPw, 'PASSENGER');
    console.log('Seed OK (dev): admin, driver@local, p1@local, p2@local + pontos');
  } else {
    console.log(`Seed OK: admin ${adminEmail} + pontos`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
