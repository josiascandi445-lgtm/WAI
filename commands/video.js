import yts from "yt-search";
import ytdl from "ytdl-core";
import fs from "fs";
import path from "path";

export default {
  name: "video",
  aliases: ["vid"],
  description: "Baixa e envia vídeo do YouTube",

  async execute({ sock, jid, msg, args }) {
    const query = args.join(" ");

    if (!query) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .video nome do vídeo"
      }, { quoted: msg });
    }

    try {
      const search = await yts(query);
      const video = search.videos[0];

      if (!video) {
        return sock.sendMessage(jid, {
          text: "❌ Nenhum vídeo encontrado"
        }, { quoted: msg });
      }

      const url = video.url;

      const tmpDir = "./tmp";
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

      const filePath = path.resolve(tmpDir, `video_${Date.now()}.mp4`);

      const stream = ytdl(url, {
        filter: "audioandvideo",
        quality: "lowest" // importante para não explodir o bot
      });

      const writeStream = fs.createWriteStream(filePath);

      stream.pipe(writeStream);

      writeStream.on("finish", async () => {
        const stats = fs.statSync(filePath);
        const sizeMB = stats.size / (1024 * 1024);

        if (sizeMB > 25) {
          fs.unlinkSync(filePath);

          return sock.sendMessage(jid, {
            text: "⚠️ Vídeo muito pesado para enviar no WhatsApp."
          }, { quoted: msg });
        }

        await sock.sendMessage(jid, {
          video: fs.readFileSync(filePath),
          mimetype: "video/mp4",
          caption: `🎥 ${video.title}`
        }, { quoted: msg });

        fs.unlinkSync(filePath);
      });

    } catch (err) {
      console.log("video error:", err);

      await sock.sendMessage(jid, {
        text: "💥 Erro ao baixar vídeo."
      }, { quoted: msg });
    }
  }
};
