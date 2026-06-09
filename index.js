/**
 * index.js — Entry point do WhatsApp Bot
 *
 * Responsabilidades:
 *  1. Iniciar servidor Express (para Render / keep-alive)
 *  2. Iniciar conexão WhatsApp via Baileys
 *  3. Gerir erros não capturados
 */

import "dotenv/config"; // carrega .env se existir (dev local)
import express from "express";
import { connectToWhatsApp } from "./lib/whatsapp.js";

const PORT = process.env.PORT ?? 3000;

// ─── SERVIDOR EXPRESS ──────────────────────────────────────────────────────────
// Mantém o processo vivo no Render e serve como health check endpoint
const app = express();

app.get("/", (_req, res) => {
  res.json({
    status: "online",
    bot: process.env.BOT_NAME ?? "WhatsApp Bot",
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`[Server] ✅ Express a correr na porta ${PORT}`);
});

// ─── BOOTSTRAP DO BOT ─────────────────────────────────────────────────────────
async function start() {
  console.log("═══════════════════════════════════════");
  console.log(`  🤖 ${process.env.BOT_NAME ?? "WhatsApp Bot"} — A Iniciar`);
  console.log("═══════════════════════════════════════");

  try {
    await connectToWhatsApp();
  } catch (err) {
    console.error("[Bootstrap] Erro fatal ao iniciar o bot:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

// ─── ERROS NÃO CAPTURADOS ─────────────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  console.error("[Process] Exceção não capturada:", err.message);
  console.error(err.stack);
  // Não termina o processo para evitar restart desnecessário
  // Se for crítico, o Render reinicia automaticamente
});

process.on("unhandledRejection", (reason) => {
  console.error("[Process] Promise rejeitada sem handler:", reason);
});

process.on("SIGTERM", () => {
  console.log("[Process] SIGTERM recebido. A terminar graciosamente...");
  process.exit(0);
});

// ─── ARRANQUE ─────────────────────────────────────────────────────────────────
start();
