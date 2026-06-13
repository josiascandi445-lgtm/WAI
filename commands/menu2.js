import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  name: "menu2",
  description: "Menu avançado por categorias",

  async execute({ sock, jid, msg, botName, prefix }) {
    try {
      const files = fs.readdirSync(__dirname).filter(f => f.endsWith(".js"));
      const total = files.length;

      // FIX: sanitizar JID do bot
      const rawBotJid = sock.user?.id ?? "";
      const botJid = rawBotJid.replace(/:[\d]+@/, "@");

      let botPic = null;
      if (botJid) {
        try {
          botPic = await sock.profilePictureUrl(botJid, "image");
        } catch {
          botPic = null;
        }
      }

      const menuText =
`╭━━━〔 🤖 ${botName} 〕━━━⬣

👑 Dono: ${process.env.OWNER_NAME || "Owner"}
⚡ Estado: Online
📦 Total: ${total} comandos
⚙️ Prefixo: ${prefix}

━━━━━━━━━━━━━━

🎵 MÚSICA & VÍDEO
• ${prefix}music — Baixa áudio do YouTube
• ${prefix}play  — Alias de music
• ${prefix}song  — Info + thumbnail YouTube
• ${prefix}video — Baixa vídeo do YouTube

━━━━━━━━━━━━━━

😂 DIVERSÃO
• ${prefix}meme   — Meme aleatório (inglês)
• ${prefix}meme2  — Meme em português
• ${prefix}piada  — Piada em português
• ${prefix}dado   — Dado / escolha aleatória
• ${prefix}enquete — Votação no grupo

━━━━━━━━━━━━━━

🧠 INTELIGÊNCIA
• ${prefix}ai        — Resposta por IA
• ${prefix}google    — Pesquisa web (PT)
• ${prefix}define    — Definição de palavra
• ${prefix}translate — Traduz texto
• ${prefix}calc      — Calculadora
• ${prefix}moeda     — Conversão de moedas

━━━━━━━━━━━━━━

🌍 UTILIDADES
• ${prefix}clima   — Clima de uma cidade
• ${prefix}news    — Notícias em português
• ${prefix}ping    — Latência do bot
• ${prefix}uptime  — Tempo online
• ${prefix}sticker — Imagem → sticker
• ${prefix}repost  — Reenvia mensagem citada
• ${prefix}agendar — Agenda envio de mensagem

━━━━━━━━━━━━━━

👥 GRUPOS
• ${prefix}add     — Adiciona membro
• ${prefix}ban     — Remove membro
• ${prefix}warn    — Avisa membro (3 = ban)
• ${prefix}hidetag — Menciona todos
• ${prefix}welcome — Boas-vindas (só admins)

╰━━━━━━━━━━━━⬣`;

      if (botPic) {
        await sock.sendMessage(jid, { image: { url: botPic }, caption: menuText }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text: menuText }, { quoted: msg });
      }
    } catch (err) {
      console.error("[menu2] erro:", err.message);
      await sock.sendMessage(jid, { text: "⚠️ Erro ao abrir menu." }, { quoted: msg });
    }
  }
};
