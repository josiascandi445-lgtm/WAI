/**
 * Comando: .music / .play / .mp3
 * REESCRITO: usa yt-dlp em vez de @distube/ytdl-core.
 * Motivo: ytdl-core é bloqueado pelo YouTube em IPs de servidores cloud (Render, AWS, etc.)
 * O yt-dlp contorna esse bloqueio e é actualizado regularmente.
 */
import { ytSearch, downloadAudio } from "../lib/ytdlp.js";

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default {
  name: "music",
  aliases: ["mp3", "audio"],
  description: "Descarrega e envia música do YouTube como áudio",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .music nome da música\nExemplo: .music Burna Boy Last Last"
      }, { quoted: msg });
    }

    const query = args.join(" ");

    await sock.sendMessage(jid, {
      text: `🔎 A procurar: *${query}*...`
    }, { quoted: msg });

    try {
      // 1. Pesquisa
      const video = await ytSearch(query);

      if (video.duration > 600) {
        return sock.sendMessage(jid, {
          text: `⚠️ Música muito longa (${formatDuration(video.duration)}). Máximo: 10 minutos.`
        }, { quoted: msg });
      }

      await sock.sendMessage(jid, {
        text: `🎵 *${video.title}*\n⏱️ ${formatDuration(video.duration)}\n\n⬇️ A descarregar...`
      }, { quoted: msg });

      // 2. Download áudio → buffer
      const buffer = await downloadAudio(video.url);

      const sizeMB = buffer.length / (1024 * 1024);
      if (sizeMB > 16) {
        return sock.sendMessage(jid, {
          text: `⚠️ Ficheiro demasiado grande (${sizeMB.toFixed(1)}MB). Tenta música mais curta.`
        }, { quoted: msg });
      }

      // 3. Envia
      await sock.sendMessage(jid, {
        audio: buffer,
        mimetype: "audio/mpeg",
        fileName: `${video.title}.mp3`,
      }, { quoted: msg });

    } catch (err) {
      console.error("[music] erro:", err.message);

      let errMsg = "⚠️ Não consegui descarregar esta música.";
      if (err.message?.includes("timeout")) {
        errMsg = "⏱️ O download demorou demasiado. Tenta uma música mais curta.";
      } else if (err.message?.includes("private") || err.message?.includes("Private")) {
        errMsg = "🔒 Este vídeo é privado.";
      } else if (err.message?.includes("age") || err.message?.includes("sign in")) {
        errMsg = "🔞 Este vídeo requer verificação de idade.";
      } else if (err.message?.includes("not found") || err.message?.includes("search")) {
        errMsg = "❌ Não encontrei resultados. Tenta outro nome.";
      }

      await sock.sendMessage(jid, { text: errMsg }, { quoted: msg });
    }
  }
};
