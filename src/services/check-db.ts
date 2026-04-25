import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function check() {
  const count = await prisma.transaction.count();
  console.log("Total transactions in DB:", count);

  const recent = await prisma.transaction.findMany({
    take: 5,
    orderBy: { indexedAt: "desc" },
  });

  console.log("\nLast 5 transactions:");
  for (const tx of recent) {
    console.log(`  ${tx.program} | ${tx.signature.slice(0, 25)}... | ${tx.indexedAt}`);
  }

  await prisma.$disconnect();
}

check();