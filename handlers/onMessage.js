import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMMANDS_DIR = path.join(__dirname, "../commands");
const PREFIX = process.env.PREFIX ?? ".";
const BOT_NAME = process.env.BOT_NAME ?? "Bot";

// Cache de comandos carregados
const commandMap = new Map();
let commandsLoaded = false;

/**
 * Carrega todos os comandos da pasta /commands dinamicamente.
 * Cada ficheiro deve exportar { name: string, execute: Function }
 */
async function loadCommands() {
  if (commandsLoaded) return;

  if (!fs.existsSync(COMMANDS_DIR)) {
    console.warn("[Commands] Pasta /commands não encontrada. Nenhum comando carregado.");
    commandsLoaded = true;
    return;
  }

  const files = fs.readdirSync(COMMANDS_DIR).filter((f) => f.endsWith(".js"));

  if (files.length === 0) {
    console.warn("[Commands] Nenhum ficheiro .js encontrado em /commands.");
    commandsLoaded = true;
    return;
  }

  for (const file of files) {
    try {
      const mod = await import(path.join(COMMANDS_DIR, file));
      const command = mod.default ?? mod;

      if (!command.name || typeof command.execute !== "function") {
        console.warn(`[Commands] Ficheiro ignorado (sem name/execute): ${file}`);
        continue;
      }

      commandMap.set(command.name.toLowerCase(), command);

      // Suporte a aliases opcionais
      if (Array.isArray(command.aliases)) {
        for (const alias of command.aliases) {
          commandMap.set(alias.toLowerCase(), command);
        }
      }

      console.log(`[Commands] ✅ Comando carregado: ${PREFIX}${command.name}`);
    } catch (err) {
      console.error(`[Commands] Erro ao carregar ${file}:`, err.message);
    }
  }

  commandsLoaded = true;
  console.log(`[Commands] Total de comandos: ${commandMap.size}`);
}

/**
 * Extrai o texto da mensagem independentemente do tipo (texto, imagem com legenda, etc.)
 * @param {object} message - msg.message
 * @returns {string}
 */
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

/**
 * Extrai o JID do remetente real (funciona em grupos e privado)
 * @param {object} msg
 * @returns {string}
 */
function getSender(msg) {
  return msg.key.participant ?? msg.key.remoteJid;
}

/**
 * Handler central de mensagens.
 * Chamado para cada mensagem recebida.
 * @param {import("@whiskeysockets/baileys").WASocket} sock
 * @param {object} msg
 */
export async function handleMessage(sock, msg) {
  // Garante que os comandos estão carregados
  await loadCommands();

  const jid = msg.key.remoteJid;
  const sender = getSender(msg);
  const isGroup = jid.endsWith("@g.us");
  const body = extractText(msg.message).trim();

  if (!body) return; // Ignora mensagens sem texto

  console.log(
    `[Message] ${isGroup ? "Grupo" : "Privado"} | De: ${sender} | Texto: "${body}"`
  );

  // Verifica se é um comando
  if (!body.startsWith(PREFIX)) return;

  const [rawCmd, ...args] = body.slice(PREFIX.length).trim().split(/\s+/);
  const cmdName = rawCmd.toLowerCase();
  const command = commandMap.get(cmdName);

  if (!command) {
    console.log(`[Commands] Comando desconhecido: ${PREFIX}${cmdName}`);
    // Opcional: comentar as 3 linhas abaixo para não responder a comandos inválidos
    await sock.sendMessage(jid, {
      text: `❓ Comando *${PREFIX}${cmdName}* não encontrado.\nUsa *${PREFIX}help* para ver os comandos disponíveis.`,
    }, { quoted: msg });
    return;
  }

  console.log(`[Commands] A executar: ${PREFIX}${command.name} | Args: [${args.join(", ")}]`);

  try {
    await command.execute({ sock, msg, jid, sender, args, isGroup, prefix: PREFIX, botName: BOT_NAME });
  } catch (err) {
    console.error(`[Commands] Erro ao executar ${PREFIX}${command.name}:`, err.message);
    await sock.sendMessage(jid, {
      text: `⚠️ Ocorreu um erro ao executar o comando *${PREFIX}${command.name}*.`,
    }, { quoted: msg });
  }
}
