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

const logger = pino({ level: "silent" });

// ─── ESTADO GLOBAL DE RECONEXÃO ───────────────────────────────────────────────
// FIX: retryCount e o socket ativo vivem FORA da função para evitar
// que reconexões recursivas percam o estado ou criem leaks.
let retryCount = 0;
const MAX_RETRIES = 5;

// FIX: guarda referência ao socket ativo para poder encerrá-lo
// antes de criar um novo (evita múltiplos WebSockets simultâneos).
let activeSock = null;

// FIX: versão do Baileys obtida UMA VEZ no arranque, reutilizada nas reconexões.
// Evita HTTP request externo em cada tentativa de reconexão.
let baileysVersion = null;

async function getBaileysVersion() {
  if (baileysVersion) return baileysVersion;
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`[WhatsApp] Baileys version: ${version.join(".")} (latest: ${isLatest})`);
  baileysVersion = version;
  return version;
}

/**
 * Limpa o número de telefone: remove +, espaços, traços e parênteses.
 */
function cleanPhoneNumber(number) {
  return String(number).replace(/[^0-9]/g, "").trim();
}

/**
 * Fecha o socket ativo de forma segura, sem lançar erros.
 * Chamado SEMPRE antes de criar um novo socket.
 */
function closeActiveSock() {
  if (!activeSock) return;
  try {
    // ev.removeAllListeners evita que os handlers do socket antigo
    // continuem a disparar depois de o socket ser encerrado.
    activeSock.ev.removeAllListeners();
    activeSock.end();
  } catch (_) {
    // ignora erros ao fechar — o socket pode já estar morto
  }
  activeSock = null;
}

/**
 * Cria e inicializa a conexão com o WhatsApp via Baileys.
 * Suporta pairing code. Reconecta automaticamente até MAX_RETRIES.
 */
export async function connectToWhatsApp() {
  // FIX: fecha socket anterior antes de criar novo → sem socket leaks
  closeActiveSock();

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

  // FIX: versão obtida uma só vez e reutilizada
  const version = await getBaileysVersion();

  const sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: false,

    // FIX: browser string atualizado — Chrome 120 é reconhecido pelo WhatsApp Web.
    // Versões muito antigas (ex: Chrome 20) podem ser detetadas e forçar logout.
    browser: ["WAI-Bot", "Chrome", "120.0.0"],

    syncFullHistory: false,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,

    // FIX: keepAliveIntervalMs — envia pings periódicos ao servidor do WhatsApp.
    // Sem isso, uma conexão inativa por ~5-10 minutos é fechada pelo servidor.
    // 30 segundos é um intervalo seguro e comprovado em produção.
    keepAliveIntervalMs: 30_000,

    // FIX: connectTimeoutMs — se ficar preso em "connecting" mais de 60s,
    // desiste e aciona o handler de reconnect em vez de ficar preso para sempre.
    connectTimeoutMs: 60_000,

    // FIX: getMessage com fallback real para evitar loops de "message retry".
    // Quando o WhatsApp pede reenvio de uma mensagem que o bot não tem em cache,
    // retornar undefined causa retry infinito. Retornar null encerra o retry.
    getMessage: async (key) => {
      console.log(`[WhatsApp] getMessage solicitado para: ${key.id} — retornando null`);
      return null;
    },
  });

  // Regista como socket ativo
  activeSock = sock;

  // ─── PAIRING CODE ─────────────────────────────────────────────────────────────
  if (!state.creds.registered) {
    const rawNumber = process.env.PAIRING_NUMBER;
    if (!rawNumber) {
      console.error(
        "[WhatsApp] ERRO: PAIRING_NUMBER não definido!\n" +
        "           Define no .env ou nas variáveis do Render: ex. 244912345678"
      );
      process.exit(1);
    }

    const phoneNumber = cleanPhoneNumber(rawNumber);
    console.log(`[WhatsApp] A solicitar pairing code para: +${phoneNumber}`);

    // Aguarda o socket estabelecer a ligação WS antes de pedir o código
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

  // ─── SALVAR CREDENCIAIS ────────────────────────────────────────────────────────
  sock.ev.on("creds.update", saveCreds);

  // ─── ESTADO DA CONEXÃO ─────────────────────────────────────────────────────────
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      retryCount = 0;
      const botName = sock.user?.name ?? "Bot";
      const botJid  = sock.user?.id   ?? "desconhecido";
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

      console.log(`[WhatsApp] Conexão fechada. Razão: ${reason} (código: ${statusCode})`);

      // ── Logged out: sessão inválida, limpa tudo e termina ──────────────────
      if (statusCode === DisconnectReason.loggedOut) {
        console.log("[WhatsApp] ⚠️  Sessão terminada (logged out). A limpar sessão...");
        try {
          fs.readdirSync(SESSION_DIR).forEach((file) => {
            fs.rmSync(path.join(SESSION_DIR, file), { recursive: true, force: true });
          });
        } catch (e) {
          console.error("[WhatsApp] Erro ao limpar sessão:", e.message);
        }
        console.log("[WhatsApp] Sessão limpa. O Render irá reiniciar e pedir novo pairing.");
        process.exit(1);
        return;
      }

      // ── Restart required: o servidor pediu reconexão imediata ─────────────
      if (statusCode === DisconnectReason.restartRequired) {
        console.log("[WhatsApp] Restart necessário pelo servidor. A reconectar imediatamente...");
        retryCount = 0; // reinício pelo servidor não conta como falha
        connectToWhatsApp();
        return;
      }

      // ── Todas as outras razões: reconecta com backoff exponencial ──────────
      if (retryCount < MAX_RETRIES) {
        retryCount++;
        // Backoff: 5s, 10s, 20s, 30s, 30s (cap em 30s)
        const delay = Math.min(5000 * Math.pow(2, retryCount - 1), 30_000);
        console.log(
          `[WhatsApp] A reconectar em ${delay / 1000}s... (tentativa ${retryCount}/${MAX_RETRIES})`
        );
        setTimeout(() => connectToWhatsApp(), delay);
      } else {
        console.error(`[WhatsApp] ❌ Máximo de reconexões (${MAX_RETRIES}) atingido. A terminar processo.`);
        process.exit(1);
      }
    }
  });

  // ─── HANDLER DE MENSAGENS ──────────────────────────────────────────────────────
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
