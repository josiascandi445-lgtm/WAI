import ytdl from "ytdl-core";
import { search } from "yt-search";

export default {
  name: "music",
  aliases: ["song", "audio"],
  description: "Baixa e envia música via YouTube",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(
        jid,
        { text: "❌ Usa: .music nome da música" },
        { quoted: msg }
      );
    }

    const query = args.join(" ");

    await sock.sendMessage(
      jid,
      { text: `🔎 A procurar: ${query}` },
      { quoted: msg }
    );

    try {
      const result = await search(query);
      const video = result?.videos?.[0];

      if (!video) {
        return sock.sendMessage(
          jid,
          { text: "❌ Nada encontrado." },
          { quoted: msg }
        );
      }

      const url = video.url;

      if (!ytdl.validateURL(url)) {
        return sock.sendMessage(
          jid,
          { text: "❌ URL inválido do YouTube." },
          { quoted: msg }
        );
      }

      await sock.sendMessage(
        jid,
        { text: "🎵 A preparar áudio..." },
        { quoted: msg }
      );

      const stream = ytdl(url, {
        filter: "audioonly",
        quality: "highestaudio",
        requestOptions: {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9"
          }
        }
      });

      const chunks = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);

      if (!buffer || buffer.length === 0) {
        return sock.sendMessage(
          jid,
          { text: "⚠️ Não foi possível gerar o áudio." },
          { quoted: msg }
        );
      }

      await sock.sendMessage(
        jid,
        {
          audio: buffer,
          mimetype: "audio/mpeg",
          ptt: true
        },
        { quoted: msg }
      );

    } catch (err) {
      console.error("[music] erro:", err);

      await sock.sendMessage(
        jid,
        { text: "⚠️ Erro ao processar música." },
        { quoted: msg }
      );
    }
  }
};
