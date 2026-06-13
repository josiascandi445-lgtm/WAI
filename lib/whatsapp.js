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

let retryCount  = 0;
const MAX_RETRIES = 10;
let isConnecting  = false;  // evita reconexões paralelas

function cleanPhoneNumber(number) {
  return String(number).replace(/[^0-9]/g, "").trim();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export async function connectToWhatsApp() {
  // Evita múltiplas chamadas em simultâneo
  if (isConnecting) {
    console.log("[WhatsApp] Já a conectar. Ignorando chamada duplicada.");
    return;
  }
  isConnecting = true;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    console.log(`[WhatsApp] Baileys v${version.join(".")} | Latest: ${isLatest}`);
    console.log(`[WhatsApp] Node.js ${process.version}`);

    const sock = makeWASocket({
      version,
      logger,
      auth: {
        creds:  state.creds,
        keys:   makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal:          false,
      browser:                    ["Ubuntu", "Chrome", "20.0.04"],
      syncFullHistory:            false,
      markOnlineOnConnect:        false,
      generateHighQualityLinkPreview: false,
      getMessage:                 async () => undefined,
      keepAliveIntervalMs:        25_000,
    });

    // ─── PAIRING CODE ────────────────────────────────────────────
    if (!state.creds.registered) {
      const rawNumber = process.env.PAIRING_NUMBER;
      if (!rawNumber) {
        console.error("[WhatsApp] ERRO: PAIRING_NUMBER não definido!");
        process.exit(1);
      }

      const phoneNumber = cleanPhoneNumber(rawNumber);
      console.log(`[WhatsApp] A aguardar ligação ao servidor (+${phoneNumber})...`);

      // Aguarda o evento "connecting" com .on() + remoção manual
      // (o Baileys não tem .once())
      await new Promise((resolve) => {
        const fallback = setTimeout(resolve, 15_000);
        const onUpdate = (u) => {
          if (u.connection === "connecting" || u.connection === "open") {
            clearTimeout(fallback);
            sock.ev.off("connection.update", onUpdate);
            setTimeout(resolve, 1500);
          }
        };
        sock.ev.on("connection.update", onUpdate);
      });

      // Tenta obter o código até 3 vezes
      let code = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`[WhatsApp] A pedir pairing code... (tentativa ${attempt}/3)`);
          code = await sock.requestPairingCode(phoneNumber);
          if (code) break;
        } catch (err) {
          console.error(`[WhatsApp] Tentativa ${attempt} falhou: ${err.message}`);
          if (attempt < 3) await sleep(3000);
        }
      }

      if (code) {
        const fmt = code.match(/.{1,4}/g)?.join("-") ?? code;
        console.log("\n╔══════════════════════════════════╗");
        console.log(`║  PAIRING CODE: ${fmt.padEnd(19)}║`);
        console.log("║  WhatsApp → Dispositivos Ligados ║");
        console.log("║  → Ligar um dispositivo          ║");
        console.log("╚══════════════════════════════════╝\n");
      } else {
        console.error("[WhatsApp] ❌ Não consegui obter pairing code. Reinicia o serviço.");
      }
    }

    // ─── CREDENCIAIS ─────────────────────────────────────────────
    sock.ev.on("creds.update", saveCreds);

    // ─── CONEXÃO ─────────────────────────────────────────────────
    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === "connecting") {
        console.log("[WhatsApp] A conectar ao servidor WhatsApp...");
      }

      if (connection === "open") {
        retryCount  = 0;
        isConnecting = false;
        console.log(`[WhatsApp] ✅ Conectado como: ${sock.user?.name ?? "Bot"} (${sock.user?.id ?? "?"})`);
        console.log("[WhatsApp] 🟢 Pronto para receber mensagens.");
      }

      if (connection === "close") {
        isConnecting = false;
        const code   = lastDisconnect?.error?.output?.statusCode;
        const reason = Object.entries(DisconnectReason).find(([, v]) => v === code)?.[0] ?? "Desconhecido";

        console.log(`[WhatsApp] ❌ Desconectado — ${reason} (${code})`);

        // Sessão inválida → limpa e reinicia
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

        // restartRequired → reconecta imediatamente (acontece após pairing)
        if (code === DisconnectReason.restartRequired) {
          console.log("[WhatsApp] Reinício necessário. A reconectar...");
          retryCount = 0;
          await sleep(1000); // pequena pausa para o socket fechar limpo
          connectToWhatsApp();
          return;
        }

        // Outros erros → backoff exponencial
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          const delay = Math.min(5000 * retryCount, 60_000);
          console.log(`[WhatsApp] Reconexão ${retryCount}/${MAX_RETRIES} em ${delay / 1000}s...`);
          await sleep(delay);
          connectToWhatsApp();
        } else {
          console.error("[WhatsApp] ❌ Máximo de reconexões atingido.");
          process.exit(1);
        }
      }
    });

    // ─── MENSAGENS ───────────────────────────────────────────────
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      // "notify" = mensagem nova em tempo real
      // "append" = histórico ao reconectar — ignorar
      if (type !== "notify") return;

      for (const msg of messages) {
        // Ignora mensagens sem conteúdo
        if (!msg.message) continue;
        // Ignora broadcasts (status, etc.)
        if (isJidBroadcast(msg.key.remoteJid)) continue;
        // Ignora mensagens enviadas pelo próprio bot
        if (msg.key.fromMe) continue;

        try {
          await handleMessage(sock, msg);
        } catch (err) {
          console.error("[WhatsApp] Erro ao processar mensagem:", err.message);
        }
      }
    });

    return sock;

  } catch (err) {
    isConnecting = false;
    throw err;
  }
                       }
