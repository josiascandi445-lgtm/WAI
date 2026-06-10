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
}

const logger = pino({ level: "silent" });

let retryCount = 0;
let sockGlobal = null; // 🔥 evita múltiplas instâncias
const MAX_RETRIES = 5;

function cleanPhoneNumber(number) {
  return String(number).replace(/[^0-9]/g, "").trim();
}

export async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  console.log(`[WhatsApp] Usando Baileys v${version.join(".")}`);

  // 🔥 IMPORTANTE: evita duplicar socket
  if (sockGlobal) {
    try {
      sockGlobal.end();
    } catch {}
    sockGlobal = null;
  }

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
    getMessage: async () => undefined,
  });

  sockGlobal = sock;

  sock.ev.on("creds.update", saveCreds);

  // ─── CONNECTION ─────────────────────────────
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "connecting") {
      console.log("[WhatsApp] A conectar...");
    }

    if (connection === "open") {
      console.log("[WhatsApp] ✅ Conectado");
      retryCount = 0;

      // 🔥 PAIRING SÓ AQUI (quando está estável)
      if (!state.creds.registered) {
        const rawNumber = process.env.PAIRING_NUMBER;
        if (!rawNumber) {
          console.error("[WhatsApp] PAIRING_NUMBER não definido");
          return;
        }

        const phoneNumber = cleanPhoneNumber(rawNumber);

        try {
          console.log(`[WhatsApp] A pedir pairing para +${phoneNumber}`);

          const code = await sock.requestPairingCode(phoneNumber);

          const formatted = code?.match(/.{1,4}/g)?.join("-") ?? code;

          console.log("\n╔══════════════════════╗");
          console.log(`║ ${formatted} ║`);
          console.log("╚══════════════════════╝\n");
        } catch (err) {
          console.error("[WhatsApp] erro pairing:", err.message);
        }
      }
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;

      console.log("[WhatsApp] fechou:", statusCode);

      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      if (statusCode === 401) {
        console.log("[WhatsApp] sessão inválida → apagar sessão");
        fs.rmSync(SESSION_DIR, { recursive: true, force: true });
        process.exit(1);
      }

      if (shouldReconnect && retryCount < MAX_RETRIES) {
        retryCount++;
        const delay = 5000;

        console.log(`[WhatsApp] reconnect ${retryCount}`);

        setTimeout(() => connectToWhatsApp(), delay);
      } else {
        process.exit(1);
      }
    }
  });

  // ─── MESSAGES ─────────────────────────────
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message) continue;
      if (isJidBroadcast(msg.key.remoteJid)) continue;
      if (msg.key.fromMe) continue;

      try {
        await handleMessage(sock, msg);
      } catch (err) {
        console.error("[WhatsApp] erro msg:", err.message);
      }
    }
  });

  return sock;
}
