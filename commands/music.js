import { ytSearch, downloadAudio } from "../lib/ytdlp.js";

function fmt(s) {
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default {
  name: "music",
  aliases: ["mp3", "audio"],
  description: "Descarrega e envia música do YouTube como áudio",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .music nome da música\nEx: .music Burna Boy Last Last"
      }, { quoted: msg });
    }

    const query = args.join(" ");
    await sock.sendMessage(jid, { text: `🔎 A procurar: *${query}*...` }, { quoted: msg });

    try {
      const video = await ytSearch(query);

      if (video.duration > 720) {
        return sock.sendMessage(jid, {
          text: `⚠️ Música demasiado longa (${fmt(video.duration)}). Máximo: 12 minutos.`
        }, { quoted: msg });
      }

      // Envia preview com thumbnail ANTES do download
      const previewText = `🎵 *${video.title}*\n👤 ${video.uploader}\n⏱️ ${fmt(video.duration)}\n\n⬇️ A descarregar áudio...`;

      if (video.thumbnail) {
        await sock.sendMessage(jid, {
          image: { url: video.thumbnail },
          caption: previewText
        }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text: previewText }, { quoted: msg });
      }

      const buffer = await downloadAudio(video.url);

      const sizeMB = buffer.length / (1024 * 1024);
      if (sizeMB > 16) {
        return sock.sendMessage(jid, {
          text: `⚠️ Ficheiro demasiado grande (${sizeMB.toFixed(1)}MB). Tenta música mais curta.`
        }, { quoted: msg });
      }

      await sock.sendMessage(jid, {
        audio: buffer,
        mimetype: "audio/mpeg",
        fileName: `${video.title.replace(/[^\w\s]/gi, "")}.mp3`,
      }, { quoted: msg });

    } catch (err) {
      console.error("[music] erro:", err.message);
      let m = "⚠️ Não consegui descarregar esta música.";
      if (err.message?.includes("timeout"))  m = "⏱️ O servidor demorou demasiado. Tenta novamente.";
      if (err.message?.includes("private"))  m = "🔒 Este vídeo é privado.";
      if (err.message?.includes("age"))      m = "🔞 Este vídeo requer verificação de idade.";
      await sock.sendMessage(jid, { text: m }, { quoted: msg });
    }
  }
};
