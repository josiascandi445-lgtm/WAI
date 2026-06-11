/**
 * lib/whatsapp.js — Conexão e gestão do WebSocket com o WhatsApp
 *
 * CORREÇÕES DE ESTABILIDADE:
 *   • keepAliveIntervalMs: 25_000 — envia pings WebSocket a cada 25s,
 *     mantém a ligação TCP activa ao nível de rede (evita timeout do Render/router).
 *   • MAX_RETRIES aumentado de 5 → 10 com backoff até 60s.
 *   • Flag isReconnecting previne reconexões paralelas (P8).
 *   • restartRequired reconecta imediatamente sem contar como falha.
 *   • loggedOut limpa sessão e termina para novo pairing.
 */

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidBroadcast,
} from "@whiskeysockets/baileys";
import pino from "pino";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { handleMessage } from "../handlers/onMessage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Usa o disco persistente do Render se disponível, senão pasta local
const SESSION_DIR = process.env.SESSION_PATH
  ? path.resolve(process.env.SESSION_PATH)
  : path.join(__dirname, "../session");

if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  console.log(`[WhatsApp] Pasta de sessão criada: ${SESSION_DIR}`);
}

console.log(`[WhatsApp] Sessão em: ${SESSION_DIR}`);

const logger = pino({ level: "silent" });

let retryCount = 0;
const MAX_RETRIES = 10;
let isReconnecting = false;

function cleanPhoneNumber(number) {
  return String(number).replace(/[^0-9]/g, "").trim();
}

export async function connectToWhatsApp() {
  if (isReconnecting) {
    console.log("[WhatsApp] Reconexão já em curso. A ignorar chamada duplicada.");
    return;
  }

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version, isLatest } = await fetchLatestBaileysVersion();

  console.log(`[WhatsApp] Baileys v${version.join(".")} | Latest: ${isLatest}`);

  const sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: false,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
    syncFullHistory: false,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,
    getMessage: async () => undefined,

    // ── KEEP-ALIVE DO WEBSOCKET ──────────────────────────────────────────────
    // Envia um ping WebSocket a cada 25 segundos.
    // Sem isto, routers/proxies (incluindo os do Render) fecham conexões TCP
    // inactivas após ~60s, causando a queda silenciosa da ligação.
    keepAliveIntervalMs: 25_000,
  });

  // ─── PAIRING CODE ─────────────────────────────────────────────────────────
  if (!state.creds.registered) {
    const rawNumber = process.env.PAIRING_NUMBER;
    if (!rawNumber) {
      console.error(
        "[WhatsApp] ERRO FATAL: PAIRING_NUMBER não definido!\n" +
        "           Define no Render: Dashboard → Environment → PAIRING_NUMBER\n" +
        "           Formato: só números, ex: 351912345678"
      );
      process.exit(1);
    }

    const phoneNumber = cleanPhoneNumber(rawNumber);
    console.log(`[WhatsApp] A solicitar pairing code para: +${phoneNumber}`);
    console.log("[WhatsApp] Aguarda 3 segundos...");

    await new Promise((r) => setTimeout(r, 3000));

    try {
      const code = await sock.requestPairingCode(phoneNumber);
      const formatted = code?.match(/.{1,4}/g)?.join("-") ?? code;
      console.log("\n╔══════════════════════════════════╗");
      console.log(`║  PAIRING CODE: ${formatted.padEnd(19)}║`);
      console.log("║  WhatsApp → Dispositivos Ligados ║");
      console.log("║  → Ligar um dispositivo          ║");
      console.log("╚══════════════════════════════════╝\n");
    } catch (err) {
      console.error("[WhatsApp] Falha ao obter pairing code:", err.message);
    }
  }

  // ─── SALVAR CREDENCIAIS ───────────────────────────────────────────────────
  sock.ev.on("creds.update", saveCreds);

  // ─── ESTADO DA CONEXÃO ────────────────────────────────────────────────────
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "connecting") {
      console.log("[WhatsApp] A conectar ao WhatsApp...");
    }

    if (connection === "open") {
      retryCount = 0;
      isReconnecting = false;
      const botName = sock.user?.name ?? "Bot";
      const botJid  = sock.user?.id   ?? "?";
      console.log(`[WhatsApp] ✅ Conectado como: ${botName} (${botJid})`);
      console.log("[WhatsApp] Bot pronto para receber mensagens.");
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason =
        Object.entries(DisconnectReason).find(([, v]) => v === statusCode)?.[0] ??
        "Desconhecido";

      console.log(`[WhatsApp] ❌ Conexão fechada. Razão: ${reason} (código: ${statusCode})`);
      isReconnecting = false;

      // Sessão terminada pelo WhatsApp → limpa e sai para novo pairing
      if (statusCode === DisconnectReason.loggedOut) {
        console.log("[WhatsApp] ⚠️  Sessão terminada (loggedOut). A limpar ficheiros de sessão...");
        try {
          fs.readdirSync(SESSION_DIR).forEach((file) => {
            fs.rmSync(path.join(SESSION_DIR, file), { recursive: true, force: true });
          });
          console.log("[WhatsApp] Sessão limpa. Reinicia o serviço para novo pairing.");
        } catch (e) {
          console.error("[WhatsApp] Erro ao limpar sessão:", e.message);
        }
        process.exit(1);
        return;
      }

      // Reinício pedido pelo servidor → reconecta imediatamente (não conta como falha)
      if (statusCode === DisconnectReason.restartRequired) {
        console.log("[WhatsApp] Reinício necessário. A reconectar imediatamente...");
        retryCount = 0;
        isReconnecting = true;
        connectToWhatsApp();
        return;
      }

      // Qualquer outra razão → backoff exponencial até 60s, máx. 10 tentativas
      if (retryCount < MAX_RETRIES) {
        retryCount++;
        const delay = Math.min(5000 * retryCount, 60_000);
        console.log(
          `[WhatsApp] A reconectar em ${delay / 1000}s... (tentativa ${retryCount}/${MAX_RETRIES})`
        );
        isReconnecting = true;
        setTimeout(() => {
          isReconnecting = false;
          connectToWhatsApp();
        }, delay);
      } else {
        console.error(
          `[WhatsApp] ❌ Esgotadas ${MAX_RETRIES} tentativas de reconexão. A terminar.`
        );
        process.exit(1);
      }
    }
  });

  // ─── HANDLER DE MENSAGENS ─────────────────────────────────────────────────
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message) continue;
      if (isJidBroadcast(msg.key.remoteJid)) continue;
      if (msg.key.fromMe) continue;

      try {
        await handleMessage(sock, msg);
      } catch (err) {
        console.error("[WhatsApp] Erro não tratado no handleMessage:", err.message);
      }
    }
  });

  return sock;
}
