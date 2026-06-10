import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { handleAntiLink } from "../lib/antilink.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMMANDS_DIR = path.join(__dirname, "../commands");
const PREFIX = process.env.PREFIX ?? ".";
const BOT_NAME = process.env.BOT_NAME ?? "Bot";

// Cache de comandos
const commandMap = new Map();
let commandsLoaded = false;

async function loadCommands() {
  if (commandsLoaded) return;

  if (!fs.existsSync(COMMANDS_DIR)) {
    console.warn("[Commands] Pasta /commands não encontrada.");
    commandsLoaded = true;
    return;
  }

  const files = fs.readdirSync(COMMANDS_DIR).filter((f) => f.endsWith(".js"));

  for (const file of files) {
    try {
      const filePath = path.join(COMMANDS_DIR, file);
      const mod = await import(`file://${filePath}?v=${Date.now()}`);

      const command = mod.default ?? mod;

      if (!command?.name || typeof command.execute !== "function") {
        continue;
      }

      commandMap.set(command.name.toLowerCase(), command);

      if (Array.isArray(command.aliases)) {
        for (const alias of command.aliases) {
          commandMap.set(alias.toLowerCase(), command);
        }
      }
    } catch (err) {
      console.error(`[Commands] ERRO ao carregar ${file}:`, err);
    }
  }

  commandsLoaded = true;
}

function extractText(message) {
  return (
    message?.conversation ??
    message?.extendedTextMessage?.text ??
    message?.imageMessage?.caption ??
    message?.videoMessage?.caption ??
    message?.buttonsResponseMessage?.selectedButtonId ??
    message?.listResponseMessage?.singleSelectReply?.selectedRowId ??
    ""
  );
}

function getSender(msg) {
  return msg.key.participant ?? msg.key.remoteJid;
}

export async function handleMessage(sock, msg) {
  await loadCommands();

  const jid = msg.key.remoteJid;
  const sender = getSender(msg);
  const isGroup = jid.endsWith("@g.us");
  const body = extractText(msg.message).trim();

  if (!body) return;

  console.log(`[Message] ${sender}: ${body}`);

  // 💥 ANTI-LINK TEM DE ESTAR AQUI DENTRO
  const blocked = await handleAntiLink({
    sock,
    msg,
    jid,
    sender,
    text: body,
    isGroup
  });

  if (blocked) return;

  if (!body.startsWith(PREFIX)) return;

  const [rawCmd, ...args] = body.slice(PREFIX.length).trim().split(/\s+/);
  const cmdName = rawCmd.toLowerCase();

  const command = commandMap.get(cmdName);

  if (!command) {
    await sock.sendMessage(
      jid,
      {
        text: `❓ Comando *${PREFIX}${cmdName}* não existe.`,
      },
      { quoted: msg }
    );
    return;
  }

  try {
    await command.execute({
      sock,
      msg,
      jid,
      sender,
      args,
      isGroup,
      prefix: PREFIX,
      botName: BOT_NAME,
    });
  } catch (err) {
    console.error(`[Commands] Erro em ${cmdName}:`, err);

    await sock.sendMessage(
      jid,
      {
        text: `⚠️ Erro ao executar *${cmdName}*`,
      },
      { quoted: msg }
    );
  }
}
