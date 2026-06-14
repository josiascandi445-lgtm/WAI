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

function cleanPhoneNumber(n) {
  return String(n).replace(/[^0-9]/g, "").trim();
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

// FIX: substituímos isJidBroadcast por filtros manuais explícitos.
// O isJidBroadcast do Baileys 6.7.9 tem comportamento inconsistente
// e pode bloquear JIDs válidos. Fazemos a filtragem manualmente:
function shouldIgnore(remoteJid) {
  if (!remoteJid) return true;
  // Ignorar status do WhatsApp
  if (remoteJid === "status@broadcast") return true;
  // Ignorar newsletters
  if (remoteJid.endsWith("@newsletter")) return true;
  // Ignorar outros broadcasts
  if (remoteJid.includes("@broadcast")) return true;
  // Aceitar tudo o resto: @s.whatsapp.net (privado) e @g.us (grupos)
  return false;
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

  // ─── PAIRING CODE ──────────────────────────────────────────────
  if (!state.creds.registered) {
    const rawNumber = process.env.PAIRING_NUMBER;
    if (!rawNumber) {
      console.error("[WhatsApp] ERRO: PAIRING_NUMBER não definido!");
      process.exit(1);
    }
    const phone = cleanPhoneNumber(rawNumber);
    console.log(`[WhatsApp] A aguardar ligação para pedir pairing code (+${phone})...`);

    await new Promise(r => setTimeout(r, 3000));

    for (let i = 1; i <= 3; i++) {
      try {
        console.log(`[WhatsApp] A pedir pairing code... (tentativa ${i}/3)`);
        const code = await sock.requestPairingCode(phone);
        if (code) {
          const fmt = code.match(/.{1,4}/g)?.join("-") ?? code;
          console.log("\n╔══════════════════════════════════╗");
          console.log(`║  PAIRING CODE: ${fmt.padEnd(19)}║`);
          console.log("║  WhatsApp → Dispositivos Ligados ║");
          console.log("║  → Ligar um dispositivo          ║");
          console.log("╚══════════════════════════════════╝\n");
          break;
        }
      } catch (err) {
        console.error(`[WhatsApp] Tentativa ${i} falhou:`, err.message);
        if (i < 3) await new Promise(r => setTimeout(r, 3000));
      }
    }
  }

  // ─── CREDENCIAIS ────────────────────────────────────────────────
  sock.ev.on("creds.update", saveCreds);

  // ─── MENSAGENS ──────────────────────────────────────────────────
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      // Sem mensagem real
      if (!msg.message) continue;

      const jid = msg.key.remoteJid;

      // Ignorar broadcasts, status e newsletters (filtro manual explícito)
      if (shouldIgnore(jid)) continue;

      // Ignorar mensagens do próprio bot
      if (msg.key.fromMe) continue;

      // Log de diagnóstico — ajuda a confirmar que mensagens privadas chegam
      const tipo = jid.endsWith("@g.us") ? "Grupo" : "Privado";
      console.log(`[WhatsApp] 📩 Mensagem recebida [${tipo}] de ${jid}`);

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
        console.log("[WhatsApp] A limpar sessão...");
        try {
          fs.readdirSync(SESSION_DIR).forEach(f =>
            fs.rmSync(path.join(SESSION_DIR, f), { recursive: true, force: true })
          );
        } catch {}
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

  return sock;
}
