import { ytSearch } from "../lib/ytdlp.js";

function fmt(s) {
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default {
  name: "song",
  description: "Pesquisa música no YouTube e mostra thumbnail + info",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .song nome da música\nEx: .song Dj Habias"
      }, { quoted: msg });
    }

    try {
      const query = args.join(" ");
      const v = await ytSearch(query);

      const caption =
`🎵 *${v.title}*

👤 Canal: ${v.uploader}
⏱️ Duração: ${fmt(v.duration)}
👀 Visualizações: ${v.viewCount ? Number(v.viewCount).toLocaleString("pt-PT") : "N/A"}

🔗 ${v.url}

💡 Para baixar: *.music ${query}*`;

      if (v.thumbnail) {
        await sock.sendMessage(jid, {
          image: { url: v.thumbnail },
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
