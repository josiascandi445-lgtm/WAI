import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  name: "help",
  aliases: ["h", "menu", "help"],
  description: "Mostra todos os comandos disponíveis.",

  async execute({ sock, msg, jid, prefix, botName }) {
    const commandsDir = path.join(__dirname);
    const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith(".js"));

    const commands = [];

    for (const file of files) {
      try {
        const mod = await import(path.join(commandsDir, file));
        const cmd = mod.default ?? mod;

        if (cmd.name) {
          commands.push(`${prefix}${cmd.name}`);
        }
      } catch (err) {
        console.log("Erro ao carregar comando:", file);
      }
    }

    const text = `
╭────〔 ${botName || "TOJI BOT"} 〕────⬣
│
│ 👑 Dono: Bug
│ ⚡ Status: Online
│ 📦 Comandos: ${commands.length}
│
├─📜 Lista de Comandos
│
${commands.map(c => `│ • ${c}`).join("\n")}
│
╰──────────────⬣
`;

    await sock.sendMessage(
      jid,
      { text },
      { quoted: msg }
    );
  },
};
