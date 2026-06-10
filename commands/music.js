import yts from "yt-search";
import ytdl from "ytdl-core";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";

ffmpeg.setFfmpegPath(ffmpegPath);

export default {
  name: "music",
  aliases: ["m"],
  description: "Toca música do YouTube",

  async execute({ sock, msg, jid, args }) {
    const text = args.join(" ");

    if (!text) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .music nome da música"
      });
    }

    try {
      const search = await yts(text);
      const video = search.videos[0];

      if (!video) {
        return sock.sendMessage(jid, {
          text: "❌ Não encontrei nada."
        });
      }

      const url = video.url;

      const tmpDir = "./tmp";
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

      const fileName = `music_${Date.now()}.mp3`;
      const filePath = path.resolve(tmpDir, fileName);

      const stream = ytdl(url, {
        filter: "audioonly",
        quality: "highestaudio"
      });

      ffmpeg(stream)
        .audioBitrate(128)
        .save(filePath)
        .on("end", async () => {

          const audio = fs.readFileSync(filePath);

          await sock.sendMessage(jid, {
            audio,
            mimetype: "audio/mp4",
            ptt: true
          });

          fs.unlinkSync(filePath);
        });

    } catch (err) {
      console.log("music error:", err);

      await sock.sendMessage(jid, {
        text: "💥 Erro ao baixar música."
      });
    }
  }
};
