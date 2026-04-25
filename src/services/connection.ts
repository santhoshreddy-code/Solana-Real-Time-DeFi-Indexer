import { Connection } from "@solana/web3.js";
import dotenv from "dotenv";

// Load our .env file so we can use the API key
dotenv.config();

// Create a connection to Solana mainnet using our Helius endpoint
const RPC_URL = process.env.HELIUS_RPC_URL!;
export const connection = new Connection(RPC_URL, "confirmed");

// Quick test — can we talk to Solana?
async function testConnection() {
  try {
    // getSlot() asks Solana "what's the latest block number?"
    const slot = await connection.getSlot();
    console.log("✅ Connected to Solana!");
    console.log(`📦 Current slot: ${slot}`);

    // getBlockTime() asks "what time was this block created?"
    const blockTime = await connection.getBlockTime(slot);
    if (blockTime) {
      const date = new Date(blockTime * 1000);
      console.log(`🕐 Block time: ${date.toISOString()}`);
    }

    // How many transactions per second is Solana doing right now?
    const perfSamples = await connection.getRecentPerformanceSamples(1);
    if (perfSamples.length > 0) {
      const tps = perfSamples[0].numTransactions / perfSamples[0].samplePeriodSecs;
      console.log(`⚡ Current TPS: ${Math.round(tps)} transactions/second`);
    }

    console.log("\n🎉 Your indexer can talk to Solana! Ready for Stage 3.");
  } catch (error) {
    console.error("❌ Connection failed:", error);
  }
}

// Run the test
testConnection();