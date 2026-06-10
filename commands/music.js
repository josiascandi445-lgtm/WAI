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

      console.log("[music] vídeo:", video.title);
      console.log("[music] url:", url);

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
            "Accept-Language": "en-US,en;q=0.9",
            Referer: "https://www.youtube.com/"
          }
        }
      });

      const chunks = [];
      let total = 0;

      for await (const chunk of stream) {
        total += chunk.length;
        chunks.push(chunk);
      }

      console.log("[music] bytes recebidos:", total);

      if (total === 0) {
        throw new Error("Stream vazio do YouTube");
      }

      const buffer = Buffer.concat(chunks);

      await sock.sendMessage(
        jid,
        {
          audio: buffer,
          mimetype: "audio/mpeg",
          ptt: true
        },
        { quoted: msg }
      );

      console.log("[music] áudio enviado");

    } catch (err) {
      console.error("[music] erro completo:", err);

      await sock.sendMessage(
        jid,
        {
          text: `⚠️ Erro: ${err?.message || err}`
        },
        { quoted: msg }
      );
    }
  }
};
