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

// ─── WRAPPER DE REFERÊNCIA ────────────────────────────────────────────────────
// Em vez de passar o sock directamente ao handler, usamos um objecto wrapper.
// Quando o bot reconecta (restartRequired), actualiza sockRef.current
// sem precisar de re-registar o evento messages.upsert em cada reconexão.
// Isso resolve a race condition entre saveCreds e a reconexão.
const sockRef = { current: null, ready: false };

function cleanPhoneNumber(number) {
  return String(number).replace(/[^0-9]/g, "").trim();
}

// Sanitiza JID do bot: "244945117629:39@s.whatsapp.net" → "244945117629@s.whatsapp.net"
function sanitizeBotJid(jid) {
  if (!jid) return jid;
  return jid.replace(/:[\d]+@/, "@");
}

async function scheduleReconnect(delay = 0) {
  if (reconnectLock) {
    console.log("[WhatsApp] Reconexão já agendada. A ignorar duplicado.");
    return;
  }
  reconnectLock = true;
  sockRef.ready = false;
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

  // Actualiza a referência global imediatamente
  sockRef.current = sock;
  sockRef.ready = false;

  // ─── PAIRING CODE ──────────────────────────────────────────────
  if (!state.creds.registered) {
    const rawNumber = process.env.PAIRING_NUMBER;
    if (!rawNumber) {
      console.error("[WhatsApp] ERRO: PAIRING_NUMBER não definido!");
      process.exit(1);
    }

    const phoneNumber = cleanPhoneNumber(rawNumber);
    console.log(`[WhatsApp] A aguardar ligação ao servidor (+${phoneNumber})...`);

    // Aguarda evento "connecting" antes de pedir o código (máx 15s)
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 15_000);
      sock.ev.once("connection.update", (u) => {
        if (u.connection === "connecting" || u.connection === "open") {
          clearTimeout(timer);
          setTimeout(resolve, 1500);
        }
      });
    });

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
      console.error("[WhatsApp] Não foi possível obter pairing code. Reinicia o serviço.");
    }
  }

  // ─── SALVAR CREDENCIAIS ────────────────────────────────────────
  sock.ev.on("creds.update", saveCreds);

  // ─── ESTADO DA CONEXÃO ─────────────────────────────────────────
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "connecting") {
      console.log("[WhatsApp] A conectar ao servidor WhatsApp...");
    }

    if (connection === "open") {
      retryCount = 0;
      reconnectLock = false;

      // FIX RACE CONDITION: espera 2s após "open" para garantir que:
      // 1. saveCreds() terminou de escrever todos os ficheiros da sessão
      // 2. O pipeline interno de encriptação do Baileys está totalmente inicializado
      // Sem este delay, sendMessage pode silenciosamente falhar.
      await new Promise(r => setTimeout(r, 2000));

      sockRef.current = sock;
      sockRef.ready = true;

      // Sanitiza o JID: remove o ":XX" que o Baileys adiciona internamente
      const rawJid  = sock.user?.id ?? "desconhecido";
      const botJid  = sanitizeBotJid(rawJid);
      const botName = sock.user?.name ?? process.env.BOT_NAME ?? "Bot";

      console.log(`[WhatsApp] ✅ Conectado como: ${botName} (${botJid})`);
      console.log("[WhatsApp] 🟢 Pronto para receber mensagens.");
    }

    if (connection === "close") {
      sockRef.ready = false;

      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason =
        Object.entries(DisconnectReason).find(([, v]) => v === statusCode)?.[0] ??
        "Desconhecido";

      console.log(`[WhatsApp] ❌ Desconectado — ${reason} (${statusCode})`);

      if (statusCode === DisconnectReason.loggedOut) {
        console.log("[WhatsApp] ⚠️ Logged out. A limpar sessão...");
        try {
          fs.readdirSync(SESSION_DIR).forEach(file =>
            fs.rmSync(path.join(SESSION_DIR, file), { recursive: true, force: true })
          );
        } catch (e) {
          console.error("[WhatsApp] Erro ao limpar sessão:", e.message);
        }
        console.log("[WhatsApp] Sessão limpa. A reiniciar...");
        process.exit(1);
        return;
      }

      if (statusCode === DisconnectReason.restartRequired) {
        console.log("[WhatsApp] Reinício necessário. A reconectar...");
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

  // ─── HANDLER DE MENSAGENS ─────────────────────────────────────────────────
  // Registado UMA vez no primeiro sock.
  // Usa sockRef.current para ter sempre o sock activo mais recente.
  // Usa sockRef.ready para não processar mensagens antes do sock estar pronto.
  if (!sockRef._handlerRegistered) {
    sockRef._handlerRegistered = true;

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;
      if (!sockRef.ready || !sockRef.current) return;

      for (const msg of messages) {
        if (!msg.message) continue;
        if (isJidBroadcast(msg.key.remoteJid)) continue;
        if (msg.key.fromMe) continue;

        try {
          await handleMessage(sockRef.current, msg);
        } catch (err) {
          console.error("[WhatsApp] Erro ao processar mensagem:", err.message);
        }
      }
    });
  } else {
    // Nas reconexões, regista o handler no novo sock também
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;
      if (!sockRef.ready || !sockRef.current) return;

      for (const msg of messages) {
        if (!msg.message) continue;
        if (isJidBroadcast(msg.key.remoteJid)) continue;
        if (msg.key.fromMe) continue;

        try {
          await handleMessage(sockRef.current, msg);
        } catch (err) {
          console.error("[WhatsApp] Erro ao processar mensagem:", err.message);
        }
      }
    });
  }

  return sock;
}

// Exporta sockRef para uso nos comandos que precisam (ex: verificar estado)
export { sockRef };
