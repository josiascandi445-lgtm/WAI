import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMMANDS_DIR = path.join(__dirname, "../commands");
const PREFIX   = process.env.PREFIX   ?? ".";
const BOT_NAME = process.env.BOT_NAME ?? "Bot";

const commandMap = new Map();
let commandsLoaded = false;

async function loadCommands() {
  if (commandsLoaded) return;

  if (!fs.existsSync(COMMANDS_DIR)) {
    console.warn("[Commands] Pasta /commands não encontrada.");
    commandsLoaded = true;
    return;
  }

  const files = fs.readdirSync(COMMANDS_DIR).filter(f => f.endsWith(".js"));
  let loaded = 0, failed = 0;

  for (const file of files) {
    try {
      const mod = await import(path.join(COMMANDS_DIR, file));
      const cmd = mod.default ?? mod;
      if (!cmd.name || typeof cmd.execute !== "function") continue;
      commandMap.set(cmd.name.toLowerCase(), cmd);
      if (Array.isArray(cmd.aliases)) {
        for (const alias of cmd.aliases) commandMap.set(alias.toLowerCase(), cmd);
      }
      loaded++;
    } catch (err) {
      console.error(`[Commands] ❌ Erro ao carregar ${file}: ${err.message}`);
      failed++;
    }
  }

  commandsLoaded = true;
  console.log(`[Commands] ✅ ${loaded} comandos carregados${failed ? `, ⚠️ ${failed} falharam` : ""}`);
  console.log(`[Commands] Prefixo: "${PREFIX}" | Entradas no mapa: ${commandMap.size}`);
}

function extractText(message) {
  if (!message) return "";
  if (message.ephemeralMessage)  return extractText(message.ephemeralMessage.message);
  if (message.viewOnceMessage)   return extractText(message.viewOnceMessage.message);
  if (message.viewOnceMessageV2) return extractText(message.viewOnceMessageV2.message);
  return (
    message.conversation ??
    message.extendedTextMessage?.text ??
    message.imageMessage?.caption ??
    message.videoMessage?.caption ??
    message.buttonsResponseMessage?.selectedButtonId ??
    message.listResponseMessage?.singleSelectReply?.selectedRowId ??
    message.templateButtonReplyMessage?.selectedId ??
    ""
  );
}

function getSender(msg) {
  return msg.key.participant ?? msg.key.remoteJid;
}

// FIX @lid: o WhatsApp usa @lid para linked devices mas sock.sendMessage
// precisa de @s.whatsapp.net. Porém o número real do utilizador pode ser
// diferente do ID @lid — guardamos AMBOS para comparações de admin.
function normalizeJid(jid) {
  if (!jid) return jid;
  if (jid.endsWith("@lid")) return jid.replace("@lid", "@s.whatsapp.net");
  return jid;
}

export async function handleMessage(sock, msg) {
  await loadCommands();

  const rawJid  = msg.key.remoteJid;
  const jid     = normalizeJid(rawJid);
  const rawSender = getSender(msg);
  const sender  = normalizeJid(rawSender);
  const isGroup = rawJid.endsWith("@g.us");
  const body    = extractText(msg.message).trim();

  if (!body) return;
  if (!body.startsWith(PREFIX)) return;

  const [rawCmd, ...args] = body.slice(PREFIX.length).trim().split(/\s+/);
  const cmdName = rawCmd.toLowerCase();
  const command = commandMap.get(cmdName);

  console.log(`[Message] ${isGroup ? "Grupo" : "Privado"} | ${rawSender} | ${PREFIX}${cmdName}`);

  if (!command) {
    if (!isGroup) {
      await sock.sendMessage(jid, {
        text: `❓ Comando *${PREFIX}${cmdName}* não existe.\nUsa *${PREFIX}help* para ver os disponíveis.`,
      }, { quoted: msg });
    }
    return;
  }

  console.log(`[Commands] ▶️  ${PREFIX}${command.name} | args: [${args.join(", ")}]`);

  try {
    await command.execute({
      sock, msg, jid,
      sender,        // JID normalizado (@s.whatsapp.net) para envios
      rawSender,     // JID original (pode ser @lid) — para comparações de grupo
      args, isGroup,
      prefix: PREFIX,
      botName: BOT_NAME,
    });
  } catch (err) {
    console.error(`[Commands] ❌ Erro em ${PREFIX}${command.name}: ${err.message}`);
    console.error(err.stack);
    try {
      await sock.sendMessage(jid, {
        text: `⚠️ Erro ao executar *${PREFIX}${command.name}*. Tenta novamente.`,
      }, { quoted: msg });
    } catch {}
  }
}
