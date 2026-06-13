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
let isReady = false;

function cleanPhoneNumber(number) {
  return String(number).replace(/[^0-9]/g, "").trim();
}

async function scheduleReconnect(delay = 0) {
  if (reconnectLock) return;
  reconnectLock = true;
  isReady = false;
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
  if (!state.creds.registered) {
    const rawNumber = process.env.PAIRING_NUMBER;
    if (!rawNumber) {
      console.error("[WhatsApp] ERRO: PAIRING_NUMBER não definido!");
      process.exit(1);
    }

    const phoneNumber = cleanPhoneNumber(rawNumber);
    console.log(`[WhatsApp] A aguardar ligação ao servidor (+${phoneNumber})...`);

    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 15_000);
      const handler = (u) => {
        if (u.connection === "connecting" || u.connection === "open") {
          sock.ev.off("connection.update", handler);
          clearTimeout(timer);
          setTimeout(resolve, 1500);
        }
      };
      sock.ev.on("connection.update", handler);
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
      isReady = false;

      // Aguarda 2s para o pipeline de encriptação estabilizar
      await new Promise(r => setTimeout(r, 2000));

      isReady = true;

      const rawJid  = sock.user?.id ?? "desconhecido";
      const botJid  = rawJid.replace(/:[\d]+@/, "@");
      const botName = sock.user?.name ?? process.env.BOT_NAME ?? "Bot";

      console.log(`[WhatsApp] ✅ Conectado como: ${botName} (${botJid})`);
      console.log("[WhatsApp] 🟢 Pronto para receber mensagens.");
    }

    if (connection === "close") {
      isReady = false;

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

      // SOLUÇÃO DEFINITIVA para o restartRequired:
      // Em vez de chamar connectToWhatsApp() recursivamente dentro de um
      // event handler (o que cria condições de corrida com o sock anterior),
      // fazemos process.exit(0). O Render reinicia o processo em <10s.
      // Na nova execução: sessão está no disco → registered=true →
      // conecta directamente sem pairing → sock limpo sem estado anterior.
      if (statusCode === DisconnectReason.restartRequired) {
        console.log("[WhatsApp] Reinício necessário após pairing. A reiniciar processo...");
        // Pequeno delay para garantir que saveCreds() terminou de escrever
        await new Promise(r => setTimeout(r, 2000));
        process.exit(0);
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
    if (!isReady) {
      console.log("[WhatsApp] Mensagem recebida antes de estar pronto — ignorada.");
      return;
    }

    for (const msg of messages) {
      if (!msg.message) continue;
      if (isJidBroadcast(msg.key.remoteJid)) continue;
      if (msg.key.fromMe) continue;

      console.log(`[WhatsApp] 📨 Mensagem de ${msg.key.remoteJid}`);

      try {
        await handleMessage(sock, msg);
      } catch (err) {
        console.error("[WhatsApp] Erro ao processar mensagem:", err.message);
        console.error(err.stack);
      }
    }
  });

  return sock;
}
