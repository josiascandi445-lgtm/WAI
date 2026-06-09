import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Comando: .help
 * Lista todos os comandos disponíveis.
 */
export default {
  name: "help",
  aliases: ["h", "menu"],
  description: "Mostra todos os comandos disponíveis.",

  async execute({ sock, msg, jid, prefix, botName }) {
    const commandsDir = path.join(__dirname);
    const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith(".js"));

    const commandList = [];

    for (const file of files) {
      try {
        const mod = await import(path.join(commandsDir, file));
        const cmd = mod.default ?? mod;
        if (cmd.name && cmd.description) {
          commandList.push(`• *${prefix}${cmd.name}* — ${cmd.description}`);
        }
      } catch (_) {}
    }

    const text =
      `🤖 *${botName}* — Comandos Disponíveis\n\n` +
      commandList.join("\n") +
      `\n\n_Prefixo: \`${prefix}\`_`;

    await sock.sendMessage(jid, { text }, { quoted: msg });
  },
};
