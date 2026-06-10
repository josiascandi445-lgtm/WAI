import yts from "yt-search";
import ytdl from "ytdl-core";

export default {
  name: "play",
  description: "Toca música em áudio (estável)",

  async execute({ sock, jid, msg, args }) {

    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .play nome da música"
      }, { quoted: msg });
    }

    try {
      const query = args.join(" ");

      // 🔎 1. pesquisa no YouTube
      const search = await yts(query);
      const video = search.videos?.[0];

      if (!video) {
        return sock.sendMessage(jid, {
          text: "❌ Não encontrei música"
        }, { quoted: msg });
      }

      await sock.sendMessage(jid, {
        text: `🎵 A preparar áudio...\n\n▶️ ${video.title}`
      }, { quoted: msg });

      // 🎧 2. valida URL
      if (!ytdl.validateURL(video.url)) {
        return sock.sendMessage(jid, {
          text: "❌ link inválido"
        }, { quoted: msg });
      }

      // 🔥 3. stream de áudio (sem ffmpeg)
      const stream = ytdl(video.url, {
        filter: "audioonly",
        quality: "lowestaudio"
      });

      let chunks = [];

      stream.on("data", (chunk) => {
        chunks.push(chunk);
      });

      stream.on("end", async () => {

        try {
          const buffer = Buffer.concat(chunks);

          await sock.sendMessage(jid, {
            audio: buffer,
            mimetype: "audio/mp4",
            ptt: true
          }, { quoted: msg });

        } catch (err) {
          console.log("send error:", err);

          await sock.sendMessage(jid, {
            text: "💥 falha ao enviar áudio"
          }, { quoted: msg });
        }
      });

      stream.on("error", async (err) => {
        console.log("stream error:", err);

        await sock.sendMessage(jid, {
          text: "💥 erro ao baixar áudio do YouTube"
        }, { quoted: msg });
      });

    } catch (err) {
      console.log("play error:", err);

      await sock.sendMessage(jid, {
        text: "💥 erro no play"
      }, { quoted: msg });
    }
  }
};
