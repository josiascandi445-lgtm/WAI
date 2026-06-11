/**
 * Comando: .music <nome>
 * Pesquisa e envia áudio do YouTube como mensagem de áudio.
 * Usa @distube/ytdl-core (fork mantido após abandono do ytdl-core original).
 */
import ytdl from "@distube/ytdl-core";
import yts from "yt-search";

export default {
  name: "music",
  aliases: ["mp3", "audio"],
  description: "Descarrega e envia música do YouTube como áudio",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .music nome da música"
      }, { quoted: msg });
    }

    const query = args.join(" ");

    // Aviso imediato — downloads demoram
    await sock.sendMessage(jid, {
      text: `🔎 A procurar: *${query}*...`
    }, { quoted: msg });

    try {
      // 1. Pesquisa no YouTube
      const search = await yts(query);
      const video = search.videos?.[0];

      if (!video) {
        return sock.sendMessage(jid, {
          text: "❌ Nenhum resultado encontrado."
        }, { quoted: msg });
      }

      // Rejeita vídeos com mais de 10 minutos para não explodir memória
      if (video.seconds > 600) {
        return sock.sendMessage(jid, {
          text: `⚠️ Música muito longa (${video.timestamp}). Máximo: 10 minutos.`
        }, { quoted: msg });
      }

      await sock.sendMessage(jid, {
        text: `🎵 Encontrado: *${video.title}*\n⏱️ ${video.timestamp}\n\n⬇️ A descarregar...`
      }, { quoted: msg });

      // 2. Valida URL
      if (!ytdl.validateURL(video.url)) {
        return sock.sendMessage(jid, {
          text: "❌ URL do vídeo inválida."
        }, { quoted: msg });
      }

      // 3. Stream → Buffer em memória
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

      // Rejeita ficheiros demasiado grandes (>16MB — limite WhatsApp para áudio)
      const sizeMB = buffer.length / (1024 * 1024);
      if (sizeMB > 16) {
        return sock.sendMessage(jid, {
          text: `⚠️ Ficheiro demasiado grande (${sizeMB.toFixed(1)}MB). Tenta uma música mais curta.`
        }, { quoted: msg });
      }

      // 4. Envia como áudio (não PTT para manter controlo de reprodução)
      await sock.sendMessage(jid, {
        audio: buffer,
        mimetype: "audio/mp4",
        fileName: `${video.title}.mp4`
      }, { quoted: msg });

    } catch (err) {
      console.error("[music] erro:", err.message);

      // Mensagem de erro útil
      let errMsg = "💥 Erro ao descarregar música.";
      if (err.message?.includes("age") || err.message?.includes("sign")) {
        errMsg = "⚠️ Este vídeo requer verificação de idade ou não está disponível.";
      } else if (err.message?.includes("private")) {
        errMsg = "⚠️ Este vídeo é privado.";
      } else if (err.message?.includes("unavailable")) {
        errMsg = "⚠️ Vídeo indisponível na tua região.";
      }

      await sock.sendMessage(jid, { text: errMsg }, { quoted: msg });
    }
  }
};
