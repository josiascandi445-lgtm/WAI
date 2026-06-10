import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  name: "menu2",
  description: "Menu avançado experimental",

  async execute({ sock, jid, msg, botName, prefix }) {

    try {

      let botPic = null;

      try {
        botPic = await sock.profilePictureUrl(sock.user.id, "image");
      } catch {
        botPic = null;
      }

      const files = fs
        .readdirSync(__dirname)
        .filter(f => f.endsWith(".js"));

      const commands = [];

      for (const file of files) {
        try {
          const mod = await import(path.join(__dirname, file));
          const cmd = mod.default ?? mod;

          if (cmd.name) {
            commands.push(cmd.name);
          }
        } catch {}
      }

      const menuText = `
╭━━━〔 🤖 ${botName} 〕━━━⬣

👑 Dono: Bug
⚡ Estado: Online
📦 Total: ${commands.length} comandos

━━━━━━━━━━━━━━

🎵 MÚSICA
• ${prefix}music
• ${prefix}play
• ${prefix}song
• ${prefix}lyrics
• ${prefix}video

━━━━━━━━━━━━━━

😂 DIVERSÃO
• ${prefix}meme
• ${prefix}meme2
• ${prefix}joke
• ${prefix}joke2
• ${prefix}fact
• ${prefix}love

━━━━━━━━━━━━━━

🧠 INTELIGÊNCIA
• ${prefix}ai
• ${prefix}google
• ${prefix}wiki
• ${prefix}translate
• ${prefix}resume

━━━━━━━━━━━━━━

🌍 UTILIDADES
• ${prefix}weather
• ${prefix}time
• ${prefix}ip
• ${prefix}info
• ${prefix}info2

━━━━━━━━━━━━━━

👥 GRUPOS
• ${prefix}add
• ${prefix}hidetag
• ${prefix}delete

╰━━━━━━━━━━━━⬣
`;

      if (botPic) {

        await sock.sendMessage(
          jid,
          {
            image: { url: botPic },
            caption: menuText
          },
          { quoted: msg }
        );

      } else {

        await sock.sendMessage(
          jid,
          {
            text: menuText
          },
          { quoted: msg }
        );

      }

    } catch (err) {

      console.log("menu2 error:", err);

      await sock.sendMessage(jid, {
        text: "💥 erro ao abrir menu2"
      }, { quoted: msg });

    }
  }
};
