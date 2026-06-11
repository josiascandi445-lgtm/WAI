/**
 * Comando: .play <nome>
 * Alias de .music — envia áudio do YouTube.
 * CORREÇÃO: migrado de ytdl-core (abandonado) para @distube/ytdl-core.
 * CORREÇÃO: removido ptt:true (push-to-talk requer opus/ogg, não mp4).
 */
import ytdl from "@distube/ytdl-core";
import yts from "yt-search";

export default {
  name: "play",
  description: "Toca música em áudio do YouTube",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .play nome da música"
      }, { quoted: msg });
    }

    const query = args.join(" ");

    await sock.sendMessage(jid, {
      text: `🔎 A procurar: *${query}*...`
    }, { quoted: msg });

    try {
      const search = await yts(query);
      const video = search.videos?.[0];

      if (!video) {
        return sock.sendMessage(jid, {
          text: "❌ Não encontrei música."
        }, { quoted: msg });
      }

      if (video.seconds > 600) {
        return sock.sendMessage(jid, {
          text: `⚠️ Música demasiado longa (${video.timestamp}). Máximo: 10 minutos.`
        }, { quoted: msg });
      }

      await sock.sendMessage(jid, {
        text: `🎵 *${video.title}*\n⏱️ ${video.timestamp}\n\n⬇️ A descarregar...`
      }, { quoted: msg });

      if (!ytdl.validateURL(video.url)) {
        return sock.sendMessage(jid, {
          text: "❌ Link inválido."
        }, { quoted: msg });
      }

      const stream = ytdl(video.url, {
        filter: "audioonly",
        quality: "lowestaudio",
        requestOptions: {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          }
        }
      });

      const chunks = [];

      await new Promise((resolve, reject) => {
        stream.on("data", chunk => chunks.push(chunk));
        stream.on("end", resolve);
        stream.on("error", reject);
      });

      const buffer = Buffer.concat(chunks);

      const sizeMB = buffer.length / (1024 * 1024);
      if (sizeMB > 16) {
        return sock.sendMessage(jid, {
          text: `⚠️ Ficheiro demasiado grande (${sizeMB.toFixed(1)}MB).`
        }, { quoted: msg });
      }

      // FIX: ptt:true removido — requer codec opus; audio/mp4 não é compatível com PTT
      await sock.sendMessage(jid, {
        audio: buffer,
        mimetype: "audio/mp4",
        fileName: `${video.title}.mp4`
      }, { quoted: msg });

    } catch (err) {
      console.error("[play] erro:", err.message);

      let errMsg = "💥 Erro ao descarregar áudio do YouTube.";
      if (err.message?.includes("age") || err.message?.includes("sign")) {
        errMsg = "⚠️ Vídeo com restrição de idade.";
      } else if (err.message?.includes("unavailable")) {
        errMsg = "⚠️ Vídeo indisponível.";
      }

      await sock.sendMessage(jid, { text: errMsg }, { quoted: msg });
    }
  }
};
