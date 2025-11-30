import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // This query failed previously because centralUserId was unknown
    await prisma.session.findMany({
      where: {
        centralUserId: 1,
      },
    });
    console.log('Successfully queried with centralUserId');
  } catch (e) {
    console.error('Error querying with centralUserId:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
