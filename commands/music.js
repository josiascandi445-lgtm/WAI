import ytdl from "ytdl-core";
import { search } from "yt-search";

export default {
  name: "music",
  aliases: ["song", "audio"],
  description: "Pesquisa música e envia áudio",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(
        jid,
        { text: "❌ Usa: .music nome da música" },
        { quoted: msg }
      );
    }

    const query = args.join(" ");

    await sock.sendMessage(jid, {
      text: `🔎 A procurar: *${query}*`
    }, { quoted: msg });

    // pesquisa no YouTube
    const result = await search(query);
    const video = result.videos[0];

    if (!video) {
      return sock.sendMessage(jid, {
        text: "❌ Não encontrei nada."
      }, { quoted: msg });
    }

    const url = video.url;

    await sock.sendMessage(jid, {
      text: `🎧 A enviar: *${video.title}*`
    }, { quoted: msg });

    try {
      const stream = ytdl(url, {
        filter: "audioonly",
        quality: "highestaudio"
      });

      await sock.sendMessage(jid, {
        audio: stream,
        mimetype: "audio/mp4",
        ptt: false
      }, { quoted: msg });

    } catch (err) {
      console.error("[music] erro:", err);
      await sock.sendMessage(jid, {
        text: "⚠️ Erro ao baixar áudio."
      }, { quoted: msg });
    }
  },
};
