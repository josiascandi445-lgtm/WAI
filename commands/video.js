/**
 * Comando: .video / .vid
 * REESCRITO: usa yt-dlp em vez de @distube/ytdl-core.
 */
import { ytSearch, downloadVideo } from "../lib/ytdlp.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_DIR = path.join(__dirname, "../tmp");

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default {
  name: "video",
  aliases: ["vid"],
  description: "Descarrega e envia vídeo do YouTube",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .video nome do vídeo\nExemplo: .video Ronaldo golos 2024"
      }, { quoted: msg });
    }

    const query = args.join(" ");

    await sock.sendMessage(jid, {
      text: `🔎 A procurar vídeo: *${query}*...`
    }, { quoted: msg });

    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

    const filePath = path.join(TMP_DIR, `video_${Date.now()}.mp4`);

    try {
      const video = await ytSearch(query);

      if (video.duration > 300) {
        return sock.sendMessage(jid, {
          text: `⚠️ Vídeo demasiado longo (${formatDuration(video.duration)}). Máximo: 5 minutos.`
        }, { quoted: msg });
      }

      await sock.sendMessage(jid, {
        text: `🎥 *${video.title}*\n⏱️ ${formatDuration(video.duration)}\n\n⬇️ A descarregar...`
      }, { quoted: msg });

      await downloadVideo(video.url, filePath);

      const stats = fs.statSync(filePath);
      const sizeMB = stats.size / (1024 * 1024);

      if (sizeMB > 64) {
        return sock.sendMessage(jid, {
          text: `⚠️ Vídeo demasiado pesado (${sizeMB.toFixed(1)}MB). WhatsApp aceita até 64MB.`
        }, { quoted: msg });
      }

      await sock.sendMessage(jid, {
        video: fs.readFileSync(filePath),
        mimetype: "video/mp4",
        caption: `🎥 ${video.title}`
      }, { quoted: msg });

    } catch (err) {
      console.error("[video] erro:", err.message);

      let errMsg = "⚠️ Não consegui descarregar este vídeo.";
      if (err.message?.includes("timeout")) errMsg = "⏱️ Download demorou demasiado. Tenta vídeo mais curto.";
      else if (err.message?.includes("private")) errMsg = "🔒 Vídeo privado.";
      else if (err.message?.includes("age")) errMsg = "🔞 Vídeo com restrição de idade.";

      await sock.sendMessage(jid, { text: errMsg }, { quoted: msg });
    } finally {
      if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch {}
    }
  }
};
