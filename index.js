/**
 * index.js — Entry point do WhatsApp Bot
 *
 * ══════════════════════════════════════════════════════════════════
 * CAUSA RAIZ DA QUEDA NO RENDER
 * ══════════════════════════════════════════════════════════════════
 *
 * Existem DOIS problemas distintos que causam quedas:
 *
 * PROBLEMA 1 — Render suspende o processo (free tier)
 *   O Render free tier suspende serviços web que não recebem pedidos
 *   HTTP durante 15 minutos. Quando suspende, o processo Node.js é
 *   CONGELADO (não morto). O WebSocket TCP fica sem actividade, o
 *   servidor do WhatsApp fecha a ligação por timeout, e quando o
 *   Render "descongela" o processo, o sock está morto mas o código
 *   não sabe disso — não há reconexão porque nenhum evento "close"
 *   foi disparado enquanto o processo estava congelado.
 *
 *   SOLUÇÃO: self-ping a cada 10 minutos impede a suspensão.
 *
 * PROBLEMA 2 — TCP idle timeout do Render/router
 *   Mesmo sem suspensão, routers e proxies fecham silenciosamente
 *   conexões TCP que ficam inactivas (sem dados) por mais de ~60s.
 *   O WebSocket do Baileys não envia nada por defeito durante
 *   períodos sem mensagens, por isso o TCP é fechado pelo router
 *   sem que o Baileys receba um evento "close" (é um RST silencioso).
 *
 *   SOLUÇÃO: keepAliveIntervalMs: 25_000 no makeWASocket envia
 *   pings WebSocket a cada 25s, mantendo o TCP vivo ao nível de rede.
 *
 * AMBAS as soluções são necessárias em simultâneo.
 * ══════════════════════════════════════════════════════════════════
 */

import "dotenv/config";
import express from "express";
import { connectToWhatsApp } from "./lib/whatsapp.js";

const PORT     = process.env.PORT     ?? 3000;
const BOT_NAME = process.env.BOT_NAME ?? "WhatsApp Bot";
const START_TIME = Date.now();

// ─── SERVIDOR EXPRESS ──────────────────────────────────────────────────────────
const app = express();

app.get("/", (_req, res) => {
  const uptimeSec = Math.floor((Date.now() - START_TIME) / 1000);
  const h = Math.floor(uptimeSec / 3600);
  const m = Math.floor((uptimeSec % 3600) / 60);
  const s = uptimeSec % 60;
  res.json({
    status    : "online",
    bot       : BOT_NAME,
    uptime    : `${h}h ${m}m ${s}s`,
    timestamp : new Date().toISOString(),
    node      : process.version,
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: Date.now() });
});

app.listen(PORT, () => {
  console.log(`[Server] ✅ Express na porta ${PORT}`);
});

// ─── SELF-PING — ANTI-SLEEP DO RENDER (Solução ao Problema 1) ─────────────────
// Faz GET ao próprio /health a cada 10 minutos.
// Impede o Render free tier de congelar o processo.
// IMPORTANTE: usa RENDER_EXTERNAL_URL (variável automática do Render)
// para fazer o ping ao URL público, não ao localhost — o Render
// conta tráfego externo, não pedidos internos ao loopback.
function startSelfPing() {
  const SELF_URL = process.env.RENDER_EXTERNAL_URL
    ? `${process.env.RENDER_EXTERNAL_URL}/health`
    : `http://localhost:${PORT}/health`;

  const INTERVAL_MS = 10 * 60 * 1000; // 10 min < 15 min (limiar do Render)

  console.log(`[SelfPing] Keep-alive activo → ${SELF_URL}`);
  console.log(`[SelfPing] Intervalo: ${INTERVAL_MS / 60000} min`);

  setInterval(async () => {
    try {
      const res = await fetch(SELF_URL, { signal: AbortSignal.timeout(10_000) });
      console.log(`[SelfPing] ✅ OK (${res.status}) ${new Date().toLocaleTimeString("pt-PT")}`);
    } catch (err) {
      console.warn(`[SelfPing] ⚠️  Falha: ${err.message}`);
    }
  }, INTERVAL_MS);
}

// ─── ERROS GLOBAIS NÃO CAPTURADOS ─────────────────────────────────────────────
// Não mata o processo — no Render um crash reinicia o serviço e perde
// o estado dos comandos em memória (warns, etc.).
process.on("uncaughtException", (err) => {
  console.error("[Process] ⚠️  uncaughtException:", err.message);
  console.error(err.stack);
});

process.on("unhandledRejection", (reason) => {
  console.error("[Process] ⚠️  unhandledRejection:", reason);
});

process.on("SIGTERM", () => {
  console.log("[Process] SIGTERM recebido. A terminar...");
  process.exit(0);
});

// ─── ARRANQUE ──────────────────────────────────────────────────────────────────
async function start() {
  console.log("═══════════════════════════════════════════");
  console.log(`  🤖 ${BOT_NAME} — A Iniciar`);
  console.log(`  📅 ${new Date().toISOString()}`);
  console.log("═══════════════════════════════════════════");

  // Self-ping começa 30s após arranque (servidor Express precisa de estar pronto)
  setTimeout(startSelfPing, 30_000);

  try {
    await connectToWhatsApp();
  } catch (err) {
    console.error("[Bootstrap] Erro fatal ao iniciar:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

start();
