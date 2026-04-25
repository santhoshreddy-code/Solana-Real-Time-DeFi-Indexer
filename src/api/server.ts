import express from "express";
import dotenv from "dotenv";
import {
  getRecentTransactions,
  getTransactionsByProgram,
  getTotalCount,
} from "../services/database";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = 3000;

// Homepage — shows API info
app.get("/", (req, res) => {
  res.json({
    name: "🚀 Solana DeFi Indexer API",
    version: "1.0.0",
    endpoints: {
      "/api/stats": "Overall indexer statistics",
      "/api/transactions": "Recent transactions (use ?limit=10)",
      "/api/programs": "Transaction counts by DeFi program",
      "/api/search?signature=abc": "Search by transaction signature",
      "/api/program/:name": "Filter by program (e.g. /api/program/Jupiter)",
    },
  });
});

// GET /api/stats — Overall statistics
app.get("/api/stats", async (req, res) => {
  try {
    const totalTransactions = await getTotalCount();
    const byProgram = await getTransactionsByProgram();

    // Get latest stats snapshot
    const latestStats = await prisma.indexerStats.findFirst({
      orderBy: { timestamp: "desc" },
    });

    // Get time range of indexed data
    const oldest = await prisma.transaction.findFirst({
      orderBy: { indexedAt: "asc" },
      select: { indexedAt: true },
    });

    const newest = await prisma.transaction.findFirst({
      orderBy: { indexedAt: "desc" },
      select: { indexedAt: true },
    });

    res.json({
      totalTransactions,
      programBreakdown: byProgram.map((p) => ({
        program: p.program,
        count: p._count.program,
      })),
      timeRange: {
        from: oldest?.indexedAt || null,
        to: newest?.indexedAt || null,
      },
      lastSnapshot: latestStats,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// GET /api/transactions — Recent transactions
app.get("/api/transactions", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const transactions = await getRecentTransactions(limit);

    res.json({
      count: transactions.length,
      transactions: transactions.map((tx) => ({
        signature: tx.signature,
        program: tx.program,
        classification: tx.classification,
        slot: tx.slot,
        blockTime: tx.blockTime,
        indexedAt: tx.indexedAt,
        fee: tx.fee ? tx.fee.toString() : null,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// GET /api/programs — Counts by program
app.get("/api/programs", async (req, res) => {
  try {
    const byProgram = await getTransactionsByProgram();
    const total = await getTotalCount();

    res.json({
      total,
      programs: byProgram.map((p) => ({
        program: p.program,
        count: p._count.program,
        percentage: ((p._count.program / total) * 100).toFixed(1) + "%",
      })),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch program stats" });
  }
});

// GET /api/search?signature=abc — Search by signature
app.get("/api/search", async (req, res) => {
  try {
    const sig = req.query.signature as string;
    if (!sig) {
      return res.status(400).json({ error: "Provide ?signature=..." });
    }

    const results = await prisma.transaction.findMany({
      where: { signature: { contains: sig } },
      take: 10,
    });

    res.json({ query: sig, count: results.length, results });
  } catch (error) {
    res.status(500).json({ error: "Search failed" });
  }
});

// GET /api/program/:name — Filter by program name
app.get("/api/program/:name", async (req, res) => {
  try {
    const name = req.params.name;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const transactions = await prisma.transaction.findMany({
      where: { program: { contains: name, mode: "insensitive" } },
      orderBy: { indexedAt: "desc" },
      take: limit,
    });

    const count = await prisma.transaction.count({
      where: { program: { contains: name, mode: "insensitive" } },
    });

    res.json({
      program: name,
      totalCount: count,
      showing: transactions.length,
      transactions,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch program data" });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`\n🚀 Solana DeFi Indexer API running!`);
  console.log(`📡 http://localhost:${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  http://localhost:${PORT}/api/stats`);
  console.log(`  http://localhost:${PORT}/api/transactions`);
  console.log(`  http://localhost:${PORT}/api/programs`);
  console.log(`  http://localhost:${PORT}/api/search?signature=abc`);
  console.log(`  http://localhost:${PORT}/api/program/Jupiter`);
});