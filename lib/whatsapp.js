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

// Garante que a pasta de sessão existe
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  console.log("[WhatsApp] Pasta /session criada.");
}

// Logger silencioso para Baileys (evita flood de logs internos)
const logger = pino({ level: "silent" });

let retryCount = 0;
const MAX_RETRIES = 5;

/**
 * Limpa o número de telefone: remove +, espaços, traços e parênteses
 * @param {string} number
 * @returns {string}
 */
function cleanPhoneNumber(number) {
  return String(number).replace(/[^0-9]/g, "").trim();
}

/**
 * Cria e inicializa a conexão com o WhatsApp via Baileys.
 * Suporta pairing code. Reconecta automaticamente até MAX_RETRIES.
 */
export async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version, isLatest } = await fetchLatestBaileysVersion();

  console.log(`[WhatsApp] Usando Baileys v${version.join(".")} (latest: ${isLatest})`);

  const sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: false, // QR desativado — usamos pairing code
    browser: ["Ubuntu", "Chrome", "20.0.04"],
    syncFullHistory: false,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,
    getMessage: async () => undefined, // evita erros de mensagem não encontrada
  });

  // ─── PAIRING CODE ────────────────────────────────────────────────────────────
  // Só solicita pairing se ainda não temos credenciais registadas
  if (!state.creds.registered) {
    const rawNumber = process.env.PAIRING_NUMBER;
    if (!rawNumber) {
      console.error(
        "[WhatsApp] ERRO: PAIRING_NUMBER não definido no .env!\n" +
        "           Define o número no formato: 351912345678"
      );
      process.exit(1);
    }

    const phoneNumber = cleanPhoneNumber(rawNumber);
    console.log(`[WhatsApp] A solicitar pairing code para: +${phoneNumber}`);

    // Baileys precisa que o socket esteja ligado antes de pedir o código
    await new Promise((resolve) => setTimeout(resolve, 3000));

    try {
      const code = await sock.requestPairingCode(phoneNumber);
      const formatted = code?.match(/.{1,4}/g)?.join("-") ?? code;
      console.log("\n╔══════════════════════════════════╗");
      console.log(`║  PAIRING CODE: ${formatted.padEnd(19)}║`);
      console.log("║  Vai a WhatsApp > Dispositivos   ║");
      console.log("║  Ligados > Ligar dispositivo     ║");
      console.log("╚══════════════════════════════════╝\n");
    } catch (err) {
      console.error("[WhatsApp] Falha ao obter pairing code:", err.message);
    }
  }

  // ─── SALVAR CREDENCIAIS ───────────────────────────────────────────────────────
  sock.ev.on("creds.update", saveCreds);

  // ─── ESTADO DA CONEXÃO ────────────────────────────────────────────────────────
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // Se por alguma razão aparecer QR, informamos mas não o mostramos
      console.log("[WhatsApp] QR code recebido — ignorado (usando pairing code).");
    }

    if (connection === "open") {
      retryCount = 0;
      const botJid = sock.user?.id ?? "desconhecido";
      const botName = sock.user?.name ?? "Bot";
      console.log(`[WhatsApp] ✅ Conectado como: ${botName} (${botJid})`);
      console.log("[WhatsApp] Bot pronto para receber mensagens.");
    }

    if (connection === "connecting") {
      console.log("[WhatsApp] A conectar...");
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason = Object.entries(DisconnectReason).find(
        ([, v]) => v === statusCode
      )?.[0] ?? "Desconhecido";

      console.log(`[WhatsApp] Conexão fechada. Razão: ${reason} (${statusCode})`);

      if (statusCode === DisconnectReason.loggedOut) {
        console.log("[WhatsApp] ⚠️  Sessão terminada (logged out).");
        console.log("[WhatsApp] A limpar sessão...");
        // Apaga ficheiros de sessão para forçar novo pairing
        fs.readdirSync(SESSION_DIR).forEach((file) => {
          fs.rmSync(path.join(SESSION_DIR, file), { recursive: true, force: true });
        });
        console.log("[WhatsApp] Sessão limpa. Reinicia o servidor para fazer novo pairing.");
        process.exit(1); // Render vai reiniciar automaticamente
        return;
      }

      if (statusCode === DisconnectReason.restartRequired) {
        console.log("[WhatsApp] Reinício necessário. A reconectar...");
        retryCount = 0; // reinício pedido pelo servidor não conta como falha
        connectToWhatsApp();
        return;
      }

      if (retryCount < MAX_RETRIES) {
        retryCount++;
        const delay = Math.min(5000 * retryCount, 30000);
        console.log(`[WhatsApp] A tentar reconectar... (tentativa ${retryCount}/${MAX_RETRIES}) em ${delay / 1000}s`);
        setTimeout(() => connectToWhatsApp(), delay);
      } else {
        console.error(`[WhatsApp] ❌ Máximo de reconexões (${MAX_RETRIES}) atingido. A terminar.`);
        process.exit(1);
      }
    }
  });

  // ─── HANDLER DE MENSAGENS ─────────────────────────────────────────────────────
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    // Apenas processa novas mensagens (não histórico)
    if (type !== "notify") return;

    for (const msg of messages) {
      // Ignora mensagens de broadcast e do próprio bot
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
