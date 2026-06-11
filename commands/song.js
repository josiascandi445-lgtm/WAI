/**
 * Comando: .song
 * Pesquisa músicas no YouTube e mostra info (sem download).
 * ACTUALIZADO: usa yt-dlp para pesquisa.
 */
import { ytSearch } from "../lib/ytdlp.js";

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default {
  name: "song",
  description: "Pesquisa uma música no YouTube e mostra informação",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .song nome da música\nExemplo: .song Dj Habias"
      }, { quoted: msg });
    }

    try {
      const query = args.join(" ");
      const video = await ytSearch(query);

      const caption =
`🎵 *MÚSICA ENCONTRADA*

📌 *${video.title}*
👤 Canal: ${video.uploader || "N/A"}
⏱️ Duração: ${formatDuration(video.duration)}

🔗 ${video.url}

💡 Usa *.music ${query}* para descarregar`;

      if (video.thumbnail) {
        await sock.sendMessage(jid, {
          image: { url: video.thumbnail },
          caption
        }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text: caption }, { quoted: msg });
      }

    } catch (err) {
      console.error("[song] erro:", err.message);
      await sock.sendMessage(jid, {
        text: "❌ Não encontrei resultados. Tenta outro nome."
      }, { quoted: msg });
    }
  }
};
