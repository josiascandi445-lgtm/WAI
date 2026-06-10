import yts from "yt-search";

export default {
  name: "play",
  description: "Toca música (versão leve)",

  async execute({ sock, jid, msg, args }) {

    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .play nome da música"
      }, { quoted: msg });
    }

    try {
      const query = args.join(" ");
      const result = await yts(query);

      const video = result.videos?.[0];

      if (!video) {
        return sock.sendMessage(jid, {
          text: "❌ Não encontrei nada"
        }, { quoted: msg });
      }

      const text =
`🎵 *PLAY MODE*

▶️ ${video.title}
👤 ${video.author.name}
👀 ${video.views}

🔗 ${video.url}

⚠️ versão leve (sem download ainda)`;

      await sock.sendMessage(jid, {
        text
      }, { quoted: msg });

    } catch (err) {
      console.log(err);

      await sock.sendMessage(jid, {
        text: "💥 erro no play"
      }, { quoted: msg });
    }
  }
};
