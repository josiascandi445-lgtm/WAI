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

const SESSION_DIR =
  process.env.SESSION_PATH ??
  path.join(__dirname, "../session");

if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  console.log("[WhatsApp] Pasta de sessão criada:", SESSION_DIR);
}
console.log("[WhatsApp] Sessão em:", SESSION_DIR);

const logger = pino({ level: "silent" });

let retryCount = 0;
const MAX_RETRIES = 10;
let reconnectLock = false;

function cleanPhoneNumber(number) {
  return String(number).replace(/[^0-9]/g, "").trim();
}

async function scheduleReconnect(delay = 0) {
  if (reconnectLock) {
    console.log("[WhatsApp] Reconexão já agendada. A ignorar duplicado.");
    return;
  }
  reconnectLock = true;
  if (delay > 0) {
    console.log(`[WhatsApp] A reconectar em ${delay / 1000}s...`);
    await new Promise(r => setTimeout(r, delay));
  }
  reconnectLock = false;
  connectToWhatsApp();
}

export async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version, isLatest } = await fetchLatestBaileysVersion();

  console.log(`[WhatsApp] Baileys v${version.join(".")} | Latest: ${isLatest}`);
  console.log(`[WhatsApp] Node.js ${process.version}`);

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
    keepAliveIntervalMs: 25_000,
  });

  // ─── PAIRING CODE ──────────────────────────────────────────────
  // FIX: sock.ev não tem .once() — usar .on() com remoção manual.
  // Aguarda o WS estar activo antes de pedir o código.
  if (!state.creds.registered) {
    const rawNumber = process.env.PAIRING_NUMBER;
    if (!rawNumber) {
      console.error("[WhatsApp] ERRO: PAIRING_NUMBER não definido!");
      process.exit(1);
    }

    const phoneNumber = cleanPhoneNumber(rawNumber);
    console.log(`[WhatsApp] A aguardar conexão WS (+${phoneNumber})...`);

    // Aguarda "connecting" ou "open" via .on() com cleanup manual
    await new Promise((resolve) => {
      const fallback = setTimeout(resolve, 15_000);

      const handler = (u) => {
        if (u.connection === "connecting" || u.connection === "open") {
          clearTimeout(fallback);
          sock.ev.off("connection.update", handler); // remove listener
          setTimeout(resolve, 1500); // pequeno delay extra
        }
      };

      sock.ev.on("connection.update", handler);
    });

    // Tenta pedir o código até 3 vezes
    let code = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[WhatsApp] A pedir pairing code... (tentativa ${attempt}/3)`);
        code = await sock.requestPairingCode(phoneNumber);
        if (code) break;
      } catch (err) {
        console.error(`[WhatsApp] Tentativa ${attempt} falhou:`, err.message);
        if (attempt < 3) await new Promise(r => setTimeout(r, 3000));
      }
    }

    if (code) {
      const formatted = code.match(/.{1,4}/g)?.join("-") ?? code;
      console.log("\n╔══════════════════════════════════╗");
      console.log(`║  PAIRING CODE: ${formatted.padEnd(19)}║`);
      console.log("║  WhatsApp → Dispositivos Ligados ║");
      console.log("║  → Ligar um dispositivo          ║");
      console.log("╚══════════════════════════════════╝\n");
    } else {
      console.error("[WhatsApp] ❌ Não foi possível obter pairing code.");
      console.error("[WhatsApp] Reinicia o serviço no Render para tentar de novo.");
    }
  }

  // ─── SALVAR CREDENCIAIS ────────────────────────────────────────
  sock.ev.on("creds.update", saveCreds);

  // ─── ESTADO DA CONEXÃO ─────────────────────────────────────────
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      retryCount = 0;
      reconnectLock = false;
      const botJid  = sock.user?.id ?? "desconhecido";
      const botName = sock.user?.name ?? "Bot";
      console.log(`[WhatsApp] ✅ Conectado como: ${botName} (${botJid})`);
    }

    if (connection === "connecting") {
      console.log("[WhatsApp] A conectar ao servidor WhatsApp...");
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason =
        Object.entries(DisconnectReason).find(([, v]) => v === statusCode)?.[0] ??
        "Desconhecido";

      console.log(`[WhatsApp] ❌ Conexão fechada. Razão: ${reason} (código: ${statusCode})`);

      if (statusCode === DisconnectReason.loggedOut) {
        console.log("[WhatsApp] ⚠️ Logged out. A limpar sessão...");
        try {
          fs.readdirSync(SESSION_DIR).forEach(file => {
            fs.rmSync(path.join(SESSION_DIR, file), { recursive: true, force: true });
          });
        } catch (e) {
          console.error("[WhatsApp] Erro ao limpar sessão:", e.message);
        }
        console.log("[WhatsApp] Sessão limpa. A reiniciar...");
        process.exit(1);
        return;
      }

      if (statusCode === DisconnectReason.restartRequired) {
        console.log("[WhatsApp] Reinício necessário (pós-pairing). A reconectar...");
        retryCount = 0;
        reconnectLock = false;
        connectToWhatsApp();
        return;
      }

      if (retryCount < MAX_RETRIES) {
        retryCount++;
        const delay = Math.min(5000 * retryCount, 60_000);
        console.log(`[WhatsApp] A tentar reconectar... (${retryCount}/${MAX_RETRIES}) em ${delay / 1000}s`);
        scheduleReconnect(delay);
      } else {
        console.error(`[WhatsApp] ❌ Máximo de reconexões (${MAX_RETRIES}) atingido.`);
        process.exit(1);
      }
    }
  });

  // ─── HANDLER DE MENSAGENS ──────────────────────────────────────
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message) continue;
      if (isJidBroadcast(msg.key.remoteJid)) continue;
      if (msg.key.fromMe) continue;

      try {
        await handleMessage(sock, msg);
      } catch (err) {
        console.error("[WhatsApp] Erro ao processar mensagem:", err.message);
      }
    }
  });

  return sock;
    }
