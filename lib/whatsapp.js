import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
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

// Exportado para o index.js poder usar no endpoint /clear-session
export function clearSession() {
  try {
    const files = fs.readdirSync(SESSION_DIR);
    files.forEach(f =>
      fs.rmSync(path.join(SESSION_DIR, f), { recursive: true, force: true })
    );
    console.log("[WhatsApp] ✅ Sessão limpa com sucesso.");
    return true;
  } catch (err) {
    console.error("[WhatsApp] Erro ao limpar sessão:", err.message);
    return false;
  }
}

function cleanPhoneNumber(n) {
  return String(n).replace(/[^0-9]/g, "").trim();
}

function shouldIgnore(jid) {
  if (!jid) return true;
  if (jid === "status@broadcast") return true;
  if (jid.endsWith("@newsletter")) return true;
  if (jid.includes("@broadcast")) return true;
  return false;
}

function scheduleReconnect(delay) {
  if (reconnectLock) return;
  reconnectLock = true;
  console.log(`[WhatsApp] A reconectar em ${delay / 1000}s...`);
  setTimeout(() => {
    reconnectLock = false;
    connectToWhatsApp();
  }, delay);
}

export async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  console.log(`[WhatsApp] Baileys v${version.join(".")} | Node ${process.version}`);

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

  // ─── CREDENCIAIS ────────────────────────────────────────────────
  sock.ev.on("creds.update", saveCreds);

  // ─── MENSAGENS ──────────────────────────────────────────────────
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message) continue;
      if (shouldIgnore(msg.key.remoteJid)) continue;
      if (msg.key.fromMe) continue;

      const tipo = msg.key.remoteJid.endsWith("@g.us") ? "Grupo" : "Privado";
      console.log(`[WhatsApp] 📩 [${tipo}] de ${msg.key.remoteJid}`);

      try {
        await handleMessage(sock, msg);
      } catch (err) {
        console.error("[WhatsApp] Erro ao processar mensagem:", err.message);
        console.error(err.stack);
      }
    }
  });

  // ─── ESTADO DA CONEXÃO ──────────────────────────────────────────
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "connecting") {
      console.log("[WhatsApp] A conectar...");
    }

    if (connection === "open") {
      retryCount = 0;
      reconnectLock = false;
      const jid  = (sock.user?.id ?? "").replace(/:[\d]+@/, "@");
      const name = sock.user?.name ?? process.env.BOT_NAME ?? "Bot";
      console.log(`[WhatsApp] ✅ Conectado como: ${name} (${jid})`);
      console.log("[WhatsApp] 🟢 Pronto para receber mensagens.");
    }

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      const reason = Object.entries(DisconnectReason)
        .find(([, v]) => v === code)?.[0] ?? "Desconhecido";

      console.log(`[WhatsApp] ❌ Desconectado — ${reason} (${code})`);

      if (code === DisconnectReason.loggedOut) {
        console.log("[WhatsApp] Logged out. A limpar sessão e reiniciar...");
        clearSession();
        process.exit(1);
        return;
      }

      if (retryCount < MAX_RETRIES) {
        retryCount++;
        const delay = code === DisconnectReason.restartRequired
          ? 1000
          : Math.min(5000 * retryCount, 60_000);
        scheduleReconnect(delay);
      } else {
        console.error("[WhatsApp] ❌ Máximo de reconexões atingido. A terminar.");
        process.exit(1);
      }
    }
  });

  // ─── PAIRING CODE ──────────────────────────────────────────────
  // Feito DEPOIS de registar os eventos para não perder o restartRequired
  if (!state.creds.registered) {
    const rawNumber = process.env.PAIRING_NUMBER;
    if (!rawNumber) {
      console.error("[WhatsApp] ERRO: PAIRING_NUMBER não definido!");
      process.exit(1);
    }
    const phone = cleanPhoneNumber(rawNumber);
    console.log(`[WhatsApp] A pedir pairing code para +${phone}...`);

    // Espera 2s para o WS estabilizar
    await new Promise(r => setTimeout(r, 2000));

    let code = null;
    for (let i = 1; i <= 3; i++) {
      try {
        console.log(`[WhatsApp] A pedir pairing code... (tentativa ${i}/3)`);
        code = await sock.requestPairingCode(phone);
        if (code) break;
      } catch (err) {
        console.error(`[WhatsApp] Tentativa ${i} falhou:`, err.message);
        if (i < 3) await new Promise(r => setTimeout(r, 3000));
      }
    }

    if (code) {
      const fmt = code.match(/.{1,4}/g)?.join("-") ?? code;
      console.log("\n╔══════════════════════════════════╗");
      console.log(`║  PAIRING CODE: ${fmt.padEnd(19)}║`);
      console.log("║  WhatsApp → Dispositivos Ligados ║");
      console.log("║  → Ligar um dispositivo          ║");
      console.log("╚══════════════════════════════════╝\n");

      // FIX: timeout de 120s após mostrar o código.
      // Se o WhatsApp não responder (sessão antiga no disco, código expirado,
      // ou rejeitado silenciosamente), limpa a sessão e reinicia automaticamente.
      console.log("[WhatsApp] ⏳ Aguarda que associes o dispositivo (máx. 2 min)...");
      const pairingTimeout = setTimeout(() => {
        console.log("[WhatsApp] ⚠️  Pairing não completado em 2 minutos.");
        console.log("[WhatsApp] A limpar sessão e reiniciar para novo código...");
        clearSession();
        process.exit(1);
      }, 120_000);

      // Cancela o timeout quando a conexão abrir
      sock.ev.on("connection.update", (u) => {
        if (u.connection === "open" || u.connection === "close") {
          clearTimeout(pairingTimeout);
        }
      });

    } else {
      console.error("[WhatsApp] Não foi possível obter pairing code. A limpar sessão...");
      clearSession();
      process.exit(1);
    }
  }

  return sock;
}
