import "dotenv/config";
import express from "express";
import { connectToWhatsApp, clearSession } from "./lib/whatsapp.js";

const PORT     = process.env.PORT     ?? 3000;
const BOT_NAME = process.env.BOT_NAME ?? "WhatsApp Bot";
const START_TIME = Date.now();

const app = express();

app.get("/", (_req, res) => {
  const uptimeSec = Math.floor((Date.now() - START_TIME) / 1000);
  const h = Math.floor(uptimeSec / 3600);
  const m = Math.floor((uptimeSec % 3600) / 60);
  const s = uptimeSec % 60;
  res.json({
    status   : "online",
    bot      : BOT_NAME,
    uptime   : `${h}h ${m}m ${s}s`,
    timestamp: new Date().toISOString(),
    node     : process.version,
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: Date.now() });
});

// Endpoint para limpar a sessão via browser/curl quando o pairing fica preso.
// Uso: abre https://wai-mfll.onrender.com/clear-session no browser
// O Render reinicia automaticamente o serviço após o process.exit(1).
app.get("/clear-session", (_req, res) => {
  console.log("[Server] 🗑️  Pedido de limpeza de sessão via HTTP");
  const ok = clearSession();
  res.json({
    success: ok,
    message: ok
      ? "Sessão limpa. O bot vai reiniciar e pedir novo pairing code."
      : "Erro ao limpar sessão. Verifica os logs."
  });
  if (ok) {
    setTimeout(() => process.exit(1), 1000);
  }
});

app.listen(PORT, () => {
  console.log(`[Server] ✅ Express na porta ${PORT}`);
});

function startSelfPing() {
  const SELF_URL = process.env.RENDER_EXTERNAL_URL
    ? `${process.env.RENDER_EXTERNAL_URL}/health`
    : `http://localhost:${PORT}/health`;

  const INTERVAL_MS = 10 * 60 * 1000;

  console.log(`[SelfPing] Keep-alive activo → ${SELF_URL}`);
  console.log(`[SelfPing] Intervalo: ${INTERVAL_MS / 60000} min`);

  setInterval(async () => {
    try {
      const res = await fetch(SELF_URL, { signal: AbortSignal.timeout(10_000) });
      console.log(`[SelfPing] ✅ ${res.status} — ${new Date().toLocaleTimeString("pt-PT")}`);
    } catch (err) {
      console.warn(`[SelfPing] ⚠️  Falha: ${err.message}`);
    }
  }, INTERVAL_MS);
}

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

async function start() {
  console.log("═══════════════════════════════════════════");
  console.log(`  🤖 ${BOT_NAME} — A Iniciar`);
  console.log(`  📅 ${new Date().toISOString()}`);
  console.log("═══════════════════════════════════════════");

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
