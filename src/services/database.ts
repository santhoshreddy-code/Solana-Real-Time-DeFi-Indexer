import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function saveTransaction(data: {
  signature: string;
  slot: number;
  blockTime: Date | null;
  program: string;
  classification: string;
  success: boolean;
  fee: bigint | null;
}) {
  try {
    await prisma.transaction.upsert({
      where: { signature: data.signature },
      update: {},
      create: {
        signature: data.signature,
        slot: data.slot,
        blockTime: data.blockTime,
        program: data.program,
        classification: data.classification,
        success: data.success,
        fee: data.fee,
      },
    });
  } catch (error) {
    const err = error as any;
    if (err.code !== "P2002") {
      console.error("❌ DB Error:", error);
    }
  }
}

export async function saveStats(stats: {
  totalTransactions: number;
  jupiterCount: number;
  orcaCount: number;
  raydiumCount: number;
  serumCount: number;
  transactionsPerSec: number;
}) {
  await prisma.indexerStats.create({ data: stats });
}

export async function getRecentTransactions(limit: number = 20) {
  return prisma.transaction.findMany({
    orderBy: { indexedAt: "desc" },
    take: limit,
  });
}

export async function getTransactionsByProgram() {
  return prisma.transaction.groupBy({
    by: ["program"],
    _count: { program: true },
    orderBy: { _count: { program: "desc" } },
  });
}

export async function getTotalCount() {
  return prisma.transaction.count();
}

export async function disconnectDB() {
  await prisma.$disconnect();
}

export default prisma;