import { search } from "yt-search";
import play from "play-dl";

export default {
  name: "music",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .music nome da música"
      }, { quoted: msg });
    }

    const query = args.join(" ");

    await sock.sendMessage(jid, {
      text: `🔎 A procurar: ${query}`
    }, { quoted: msg });

    try {
      const result = await search(query);
      const video = result?.videos?.[0];

      if (!video) {
        return sock.sendMessage(jid, {
          text: "❌ Nada encontrado."
        }, { quoted: msg });
      }

      const stream = await play.stream(video.url);
      const chunks = [];

      for await (const chunk of stream.stream) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);

      await sock.sendMessage(jid, {
        audio: buffer,
        mimetype: "audio/mpeg",
        ptt: true
      }, { quoted: msg });

    } catch (err) {
      console.error("[music]", err);

      await sock.sendMessage(jid, {
        text: "⚠️ Falha ao enviar música."
      }, { quoted: msg });
    }
  }
};
