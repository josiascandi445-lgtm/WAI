/**
 * Comando: .menu2
 * FIX P2: removido import() dinâmico a cada execução.
 */
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  name: "menu2",
  description: "Menu avançado por categorias",

  async execute({ sock, jid, msg, botName, prefix }) {
    try {
      let botPic = null;
      try {
        botPic = await sock.profilePictureUrl(sock.user.id, "image");
      } catch {
        botPic = null;
      }

      const files = fs.readdirSync(__dirname).filter(f => f.endsWith(".js"));
      const total = files.length;

      const menuText =
`╭━━━〔 🤖 ${botName} 〕━━━⬣

👑 Dono: ${process.env.OWNER_NAME || "Owner"}
⚡ Estado: Online
📦 Total: ${total} comandos
⚙️ Prefixo: ${prefix}

━━━━━━━━━━━━━━

🎵 MÚSICA
• ${prefix}music — Baixa áudio do YouTube
• ${prefix}play  — Alias de music
• ${prefix}song  — Pesquisa no YouTube
• ${prefix}lyrics — Letra de música
• ${prefix}video — Baixa vídeo do YouTube

━━━━━━━━━━━━━━

😂 DIVERSÃO
• ${prefix}meme  — Meme aleatório
• ${prefix}meme2 — Meme com fallback PT
• ${prefix}joke  — Piada em inglês
• ${prefix}joke2 — Piada em português

━━━━━━━━━━━━━━

🧠 INTELIGÊNCIA
• ${prefix}ai        — Resposta rápida por IA
• ${prefix}google    — Pesquisa DuckDuckGo
• ${prefix}define    — Definição (inglês)
• ${prefix}translate — Traduz texto
• ${prefix}resume    — Resume texto longo

━━━━━━━━━━━━━━

🌍 UTILIDADES
• ${prefix}weather — Clima de uma cidade
• ${prefix}ping    — Latência do bot
• ${prefix}uptime  — Tempo online
• ${prefix}info    — Info do utilizador
• ${prefix}info2   — Perfil avançado
• ${prefix}sticker — Imagem → sticker

━━━━━━━━━━━━━━

👥 GRUPOS
• ${prefix}add     — Adiciona membro
• ${prefix}ban     — Remove membro
• ${prefix}warn    — Avisa membro (3 = ban)
• ${prefix}hidetag — Menciona todos
• ${prefix}echo    — Repete mensagem

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
