import yts from "yt-search";

export default {
  name: "video",
  description: "Pesquisa vídeos",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .video <nome>"
      }, { quoted: msg });
    }

    const query = args.join(" ");
    const result = await yts(query);

    const video = result.videos[0];

    if (!video) {
      return sock.sendMessage(jid, {
        text: "❌ Nada encontrado"
      }, { quoted: msg });
    }

    await sock.sendMessage(jid, {
      text: `🎥 ${video.title}\n${video.url}`
    }, { quoted: msg });
  }
};
