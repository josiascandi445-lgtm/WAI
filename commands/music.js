import ytdl from "ytdl-core";
import { search } from "yt-search";
import fs from "fs-extra";
import path from "path";

export default {
  name: "music",
  aliases: ["song", "audio"],
  description: "Baixa música sem travar o bot",

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

    const result = await search(query);
    const video = result.videos[0];

    if (!video) {
      return sock.sendMessage(jid, {
        text: "❌ Nada encontrado."
      }, { quoted: msg });
    }

    const url = video.url;

    const fileName = `music-${Date.now()}.mp3`;
    const filePath = path.join("./temp", fileName);

    await fs.ensureDir("./temp");

    try {
      const stream = ytdl(url, {
        filter: "audioonly",
        quality: "highestaudio"
      });

      const writeStream = fs.createWriteStream(filePath);

      stream.pipe(writeStream);

      await new Promise((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });

      await sock.sendMessage(jid, {
        audio: fs.readFileSync(filePath),
        mimetype: "audio/mp4"
      }, { quoted: msg });

      fs.unlinkSync(filePath);

    } catch (err) {
      console.error("[music] erro:", err);

      await sock.sendMessage(jid, {
        text: "⚠️ Falha ao enviar música."
      }, { quoted: msg });

      try {
        fs.unlinkSync(filePath);
      } catch {}
    }
  }
};
