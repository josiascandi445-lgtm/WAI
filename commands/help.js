/**
 * Comando: .help
 * FIX P1: removido import() dinâmico a cada execução.
 * Agora lista ficheiros sem reimportar módulos.
 */
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  name: "help",
  aliases: ["h", "menu"],
  description: "Lista todos os comandos disponíveis.",

  async execute({ sock, msg, jid, prefix, botName }) {
    try {
      // Lista ficheiros sem reimportar — apenas para contar e exibir nomes
      const files = fs.readdirSync(__dirname).filter(f => f.endsWith(".js"));
      const commandNames = files.map(f => `${prefix}${f.replace(".js", "")}`).sort();

      let botPic = null;
      try {
        botPic = await sock.profilePictureUrl(sock.user.id, "image");
      } catch {
        botPic = null;
      }

      const text =
`╭────〔 ${botName || "BOT"} 〕────⬣

👑 Dono: ${process.env.OWNER_NAME || "Owner"}
⚡ Status: Online
📦 Comandos: ${commandNames.length}
⚙️ Prefixo: ${prefix}

├─📜 COMANDOS
${commandNames.map(c => `│ • ${c}`).join("\n")}

╰──────────────⬣`;

      if (botPic) {
        await sock.sendMessage(jid, { image: { url: botPic }, caption: text }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text }, { quoted: msg });
      }
    } catch (err) {
      console.error("[help] erro:", err.message);
      await sock.sendMessage(jid, { text: "⚠️ Erro ao carregar o menu." }, { quoted: msg });
    }
  }
};
