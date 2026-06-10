import yts from "yt-search";

export default {
  name: "song",
  description: "Pesquisa músicas no YouTube",

  async execute({ sock, jid, msg, args }) {

    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .song nome da música"
      }, { quoted: msg });
    }

    try {
      const query = args.join(" ");
      const result = await yts(query);

      const video = result.videos?.[0];

      if (!video) {
        return sock.sendMessage(jid, {
          text: "❌ Não encontrei nenhuma música."
        }, { quoted: msg });
      }

      const views = video.views
        ? Number(video.views).toLocaleString()
        : "N/A";

      const caption =
`🎵 *MÚSICA ENCONTRADA*

📌 *${video.title}*

👤 Canal: ${video.author.name}
⏱️ Duração: ${video.timestamp || "N/A"}
👀 Visualizações: ${views}

🔗 ${video.url}`;

      await sock.sendMessage(
        jid,
        {
          image: {
            url: video.thumbnail
          },
          caption
        },
        { quoted: msg }
      );

    } catch (err) {
      console.log("[song] erro:", err);

      await sock.sendMessage(jid, {
        text: "💥 Erro ao procurar música."
      }, { quoted: msg });
    }
  }
};
