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

// Usa SESSION_PATH do ambiente se definido (compatível com render.yaml antigo),
// senão usa a pasta session/ relativa ao projecto.
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

// FIX: removida a flag isReconnecting que bloqueava o restartRequired.
// O restartRequired (515) é a reconexão mais importante — acontece sempre
// após um pairing bem-sucedido e NÃO deve ser bloqueada.
// Para evitar reconexões paralelas usamos um lock baseado em Promise.
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
      console.error("[WhatsApp] ERRO: PAIRING_NUMBER não definido no .env!");
      process.exit(1);
    }

    const phoneNumber = cleanPhoneNumber(rawNumber);
    console.log(`[WhatsApp] A solicitar pairing code para: +${phoneNumber}`);
    console.log("[WhatsApp] Aguarda 3 segundos...");

    // FIX: aguarda a conexão WebSocket estabilizar ANTES de pedir o código.
    // O evento "connecting" não garante que o WS handshake terminou.
    // 3s é suficiente na prática para o TCP+TLS+WS estabilizar.
    await new Promise(r => setTimeout(r, 3000));

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
      // Não termina o processo — o connection.update vai tratar o retry
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
      console.log("[WhatsApp] A conectar...");
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason =
        Object.entries(DisconnectReason).find(([, v]) => v === statusCode)?.[0] ??
        "Desconhecido";

      console.log(`[WhatsApp] ❌ Conexão fechada. Razão: ${reason} (código: ${statusCode})`);

      // ── Sessão terminada: limpa e reinicia ──────────────────────
      if (statusCode === DisconnectReason.loggedOut) {
        console.log("[WhatsApp] ⚠️  Logged out. A limpar sessão...");
        fs.readdirSync(SESSION_DIR).forEach(file => {
          fs.rmSync(path.join(SESSION_DIR, file), { recursive: true, force: true });
        });
        console.log("[WhatsApp] Sessão limpa. A reiniciar para novo pairing...");
        process.exit(1);
        return;
      }

      // ── restartRequired: reconecta IMEDIATAMENTE sem delay ──────
      // FIX PRINCIPAL: este é o código que chegava após o pairing e
      // estava a ser bloqueado. Agora reconecta sem qualquer lock.
      if (statusCode === DisconnectReason.restartRequired) {
        console.log("[WhatsApp] Reinício necessário. A reconectar imediatamente...");
        retryCount = 0;
        reconnectLock = false; // garante que não está bloqueado
        connectToWhatsApp();   // chamada directa, sem scheduleReconnect
        return;
      }

      // ── Outros erros: backoff exponencial ───────────────────────
      if (retryCount < MAX_RETRIES) {
        retryCount++;
        const delay = Math.min(5000 * retryCount, 60_000);
        console.log(
          `[WhatsApp] A tentar reconectar... (${retryCount}/${MAX_RETRIES}) em ${delay / 1000}s`
        );
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
