require('dotenv').config({ path: require('path').resolve(process.cwd(), '../../.env') });
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

const url = (process.env.DATABASE_URL ?? '').replace(/^mysql:\/\//, 'mariadb://');
const adapter = new PrismaMariaDb(url);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Deleting all checkins...');
  await prisma.checkin.deleteMany({});
  console.log('Deleting all pickup points...');
  await prisma.pickupPoint.deleteMany({});
  console.log('All checkins and pickup points have been removed.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
