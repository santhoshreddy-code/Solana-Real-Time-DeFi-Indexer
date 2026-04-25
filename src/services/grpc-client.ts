import { Connection, PublicKey } from "@solana/web3.js";
import dotenv from "dotenv";
import { saveTransaction, saveStats, disconnectDB } from "./database";

dotenv.config();

const RPC_URL = process.env.HELIUS_RPC_URL!;
const connection = new Connection(RPC_URL, "confirmed");

// Track stats
let transactionCount = 0;
let startTime = Date.now();
let currentSlot = 0;
let programCounts: Record<string, number> = {
  "Jupiter (Swap)": 0,
  "Orca Whirlpool": 0,
  "Raydium AMM": 0,
  "Serum DEX": 0,
  "Serum DEX v3": 0,
};

// Known DeFi program addresses
const DEFI_PROGRAMS: Record<string, string> = {
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4": "Jupiter (Swap)",
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc": "Orca Whirlpool",
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": "Raydium AMM",
  "srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX": "Serum DEX",
  "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin": "Serum DEX v3",
};

// Update slot every 5 seconds instead of every transaction (saves API calls)
async function updateSlotPeriodically() {
  try {
    currentSlot = await connection.getSlot();
  } catch (error) {
    // Silently skip if rate limited
  }
  setTimeout(updateSlotPeriodically, 5000);
}

// Process and SAVE each transaction
async function processTransaction(signature: string, programId: string) {
  transactionCount++;
  const programName = DEFI_PROGRAMS[programId] || "Other";
  programCounts[programName] = (programCounts[programName] || 0) + 1;

  // Save to database
  await saveTransaction({
    signature,
    slot: currentSlot,
    blockTime: new Date(),
    program: programName,
    classification: "DeFi Trade",
    success: true,
    fee: null,
  });

  // Log every 10th transaction (reduce console spam)
  if (transactionCount % 10 === 0) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(
      `💾 [${elapsed}s] ${programName} | Saved #${transactionCount} | Slot: ${currentSlot}`
    );
  }

  // Save stats every 100 transactions
  if (transactionCount % 100 === 0) {
    const elapsed = (Date.now() - startTime) / 1000;
    const tps = transactionCount / elapsed;

    await saveStats({
      totalTransactions: transactionCount,
      jupiterCount: programCounts["Jupiter (Swap)"] || 0,
      orcaCount: programCounts["Orca Whirlpool"] || 0,
      raydiumCount: programCounts["Raydium AMM"] || 0,
      serumCount: programCounts["Serum DEX"] || 0,
      transactionsPerSec: Math.round(tps * 100) / 100,
    });

    console.log(`\n📊 --- DB CHECKPOINT: ${transactionCount} saved | ${tps.toFixed(1)} tx/sec ---`);
    console.log(`    Jupiter: ${programCounts["Jupiter (Swap)"]} | Orca: ${programCounts["Orca Whirlpool"]} | Raydium: ${programCounts["Raydium AMM"]} | Serum: ${programCounts["Serum DEX"]}\n`);
  }
}

// Main function
async function startIndexer() {
  console.log("🚀 Starting Solana DeFi Indexer (with Database)...");
  console.log("💾 Transactions will be saved to PostgreSQL\n");

  // Get initial slot
  currentSlot = await connection.getSlot();
  console.log(`📦 Starting at slot: ${currentSlot}`);

  // Update slot every 5 seconds (not every transaction!)
  updateSlotPeriodically();

  const programIds = Object.keys(DEFI_PROGRAMS);

  for (const programId of programIds) {
    const programName = DEFI_PROGRAMS[programId];

    connection.onLogs(
      new PublicKey(programId),
      async (logInfo) => {
        if (logInfo.err) return;
        await processTransaction(logInfo.signature, programId);
      },
      "confirmed"
    );

    console.log(`✅ Subscribed to: ${programName}`);
  }

  console.log("\n🎧 Listening & saving... (Press Ctrl+C to stop)\n");

  process.on("SIGINT", async () => {
    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`\n\n🛑 Indexer stopped.`);
    console.log(`📊 Final: ${transactionCount} transactions saved in ${elapsed.toFixed(0)} seconds`);
    console.log(`    Jupiter: ${programCounts["Jupiter (Swap)"]} | Orca: ${programCounts["Orca Whirlpool"]} | Raydium: ${programCounts["Raydium AMM"]} | Serum: ${programCounts["Serum DEX"]}`);
    await disconnectDB();
    process.exit(0);
  });
}

startIndexer();