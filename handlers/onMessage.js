/**
 * handlers/onMessage.js — Handler central de mensagens
 *
 * FIX P10: commandsLoaded permanece false se algum comando falhar,
 *          mas os comandos que carregaram corretamente ficam disponíveis.
 *          Erros de carregamento são logados mas não bloqueiam os restantes.
 * FIX P18: resposta a comandos inválidos limitada a chats privados
 *          para evitar spam em grupos.
 */

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMMANDS_DIR = path.join(__dirname, "../commands");
const PREFIX = process.env.PREFIX ?? ".";
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

  const files = fs.readdirSync(COMMANDS_DIR).filter((f) => f.endsWith(".js"));
  let loaded = 0;
  let failed = 0;

  for (const file of files) {
    try {
      const mod = await import(path.join(COMMANDS_DIR, file));
      const command = mod.default ?? mod;

      if (!command.name || typeof command.execute !== "function") {
        console.warn(`[Commands] ⚠️  Ignorado (sem name/execute): ${file}`);
        continue;
      }

      commandMap.set(command.name.toLowerCase(), command);

      if (Array.isArray(command.aliases)) {
        for (const alias of command.aliases) {
          commandMap.set(alias.toLowerCase(), command);
        }
      }

      loaded++;
    } catch (err) {
      console.error(`[Commands] ❌ Erro ao carregar ${file}: ${err.message}`);
      failed++;
      // FIX P10: não define commandsLoaded=true ainda se houver falhas,
      // mas continua para carregar os restantes
    }
  }

  commandsLoaded = true;
  console.log(`[Commands] ✅ ${loaded} comandos carregados${failed ? `, ⚠️ ${failed} falharam` : ""}`);
  console.log(`[Commands] Prefixo: "${PREFIX}" | Entradas no mapa: ${commandMap.size}`);
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

  const jid    = msg.key.remoteJid;
  const sender = getSender(msg);
  const isGroup = jid.endsWith("@g.us");
  const body   = extractText(msg.message).trim();

  if (!body) return;
  if (!body.startsWith(PREFIX)) return;

  const [rawCmd, ...args] = body.slice(PREFIX.length).trim().split(/\s+/);
  const cmdName = rawCmd.toLowerCase();
  const command = commandMap.get(cmdName);

  console.log(`[Message] ${isGroup ? "Grupo" : "Privado"} | ${sender.split("@")[0]} | ${PREFIX}${cmdName}`);

  if (!command) {
    // FIX P18: só responde a comando inválido em chat privado,
    // evita spam em grupos (qualquer mensagem com "." dispara)
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
      sock, msg, jid, sender, args, isGroup,
      prefix: PREFIX,
      botName: BOT_NAME,
    });
  } catch (err) {
    console.error(`[Commands] ❌ Erro em ${PREFIX}${command.name}: ${err.message}`);
    await sock.sendMessage(jid, {
      text: `⚠️ Erro ao executar *${PREFIX}${command.name}*. Tenta novamente.`,
    }, { quoted: msg });
  }
}
