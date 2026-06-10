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
          text: "❌ Não encontrei música"
        }, { quoted: msg });
      }

      const text =
`🎧 *MÚSICA ENCONTRADA*

📌 ${video.title}
👤 ${video.author.name}
⏱️ ${video.timestamp || "N/A"}
👀 ${video.views}

🔗 ${video.url}`;

      await sock.sendMessage(jid, {
        text
      }, { quoted: msg });

    } catch (err) {
      console.log(err);

      await sock.sendMessage(jid, {
        text: "💥 erro ao procurar música"
      }, { quoted: msg });
    }
  }
};
