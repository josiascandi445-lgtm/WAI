import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  name: "help",
  aliases: ["h", "menu"],

  async execute({ sock, msg, jid, prefix, botName }) {

    try {
      const commandsDir = path.join(__dirname);
      const files = fs.readdirSync(commandsDir).filter(f => f.endsWith(".js"));

      const commands = [];

      for (const file of files) {
        const mod = await import(path.join(commandsDir, file));
        const cmd = mod.default ?? mod;

        if (cmd.name) {
          commands.push(`${prefix}${cmd.name}`);
        }
      }

      // 📸 pega foto do bot (perfil do WhatsApp)
      let botPic = null;

      try {
        botPic = await sock.profilePictureUrl(sock.user.id, "image");
      } catch (e) {
        botPic = null;
      }

      const text =
`╭────〔 ${botName || "BOT"} 〕────⬣

👑 Dono: Bug
⚡ Status: Online
📦 Comandos: ${commands.length}

├─📜 MENU
${commands.map(c => `│ • ${c}`).join("\n")}

╰──────────────⬣`;

      // 📸 se tiver imagem do bot
      if (botPic) {
        await sock.sendMessage(jid, {
          image: { url: botPic },
          caption: text
        }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, {
          text
        }, { quoted: msg });
      }

    } catch (err) {
      console.log("help error:", err);

      await sock.sendMessage(jid, {
        text: "💥 erro ao carregar menu"
      }, { quoted: msg });
    }
  }
};
