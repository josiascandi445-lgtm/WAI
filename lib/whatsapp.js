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
const SESSION_DIR = path.join(__dirname, "../session");

if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  console.log("[WhatsApp] Pasta /session criada.");
}

const logger = pino({ level: "silent" });

let sock; // 👈 importante: evitar múltiplas instâncias

function cleanPhoneNumber(number) {
  return String(number).replace(/[^0-9]/g, "").trim();
}

export async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version, isLatest } = await fetchLatestBaileysVersion();

  console.log(`[WhatsApp] Usando Baileys v${version.join(".")} (latest: ${isLatest})`);

  sock = makeWASocket({
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
  });

  sock.ev.on("creds.update", saveCreds);

  // ─── CONEXÃO ───────────────────────────────
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "connecting") {
      console.log("[WhatsApp] A conectar...");
    }

    if (connection === "open") {
      console.log("[WhatsApp] ✅ Conectado com sucesso");
      console.log(`[WhatsApp] Bot: ${sock.user?.name}`);
      console.log(`[WhatsApp] ID: ${sock.user?.id}`);
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;

      const shouldReconnect =
        statusCode !== DisconnectReason.loggedOut;

      console.log("[WhatsApp] Conexão fechada:", statusCode);

      if (statusCode === DisconnectReason.loggedOut) {
        console.log("[WhatsApp] Sessão inválida. A limpar...");
        fs.rmSync(SESSION_DIR, { recursive: true, force: true });
        process.exit(1);
      }

      if (shouldReconnect) {
        console.log("[WhatsApp] A reconectar...");
        setTimeout(() => connectToWhatsApp(), 5000);
      }
    }
  });

  // ─── PAIRING CODE (CORRETO AGORA) ───────────
  if (!state.creds.registered) {
    const rawNumber = process.env.PAIRING_NUMBER;

    if (!rawNumber) {
      console.error("[WhatsApp] PAIRING_NUMBER não definido");
      process.exit(1);
    }

    const phoneNumber = cleanPhoneNumber(rawNumber);

    console.log(`[WhatsApp] A pedir pairing code para +${phoneNumber}`);

    try {
      const code = await sock.requestPairingCode(phoneNumber);

      const formatted = code?.match(/.{1,4}/g)?.join("-") ?? code;

      console.log("\n╔══════════════════════════════╗");
      console.log(`║  PAIRING CODE: ${formatted}  ║`);
      console.log("╚══════════════════════════════╝\n");
    } catch (err) {
      console.error("[WhatsApp] Erro pairing:", err);
    }
  }

  // ─── MENSAGENS ─────────────────────────────
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message) continue;
      if (isJidBroadcast(msg.key.remoteJid)) continue;
      if (msg.key.fromMe) continue;

      try {
        await handleMessage(sock, msg);
      } catch (err) {
        console.error("[WhatsApp] Erro mensagem:", err);
      }
    }
  });

  return sock;
        }
