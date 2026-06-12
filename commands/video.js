import { ytSearch, downloadVideo } from "../lib/ytdlp.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_DIR = path.join(__dirname, "../tmp");

function fmt(s) {
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default {
  name: "video",
  aliases: ["vid"],
  description: "Descarrega e envia vídeo do YouTube (máx. 5 min)",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .video nome do vídeo\nEx: .video Cristiano Ronaldo golos 2024"
      }, { quoted: msg });
    }

    const query = args.join(" ");
    await sock.sendMessage(jid, { text: `🔎 A procurar vídeo: *${query}*...` }, { quoted: msg });

    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
    const filePath = path.join(TMP_DIR, `video_${Date.now()}.mp4`);

    try {
      const video = await ytSearch(query);

      if (video.duration > 300) {
        return sock.sendMessage(jid, {
          text: `⚠️ Vídeo demasiado longo (${fmt(video.duration)}). Máximo: 5 minutos.`
        }, { quoted: msg });
      }

      // Thumbnail preview antes do download
      const previewText = `🎥 *${video.title}*\n👤 ${video.uploader}\n⏱️ ${fmt(video.duration)}\n\n⬇️ A descarregar vídeo...`;
      if (video.thumbnail) {
        await sock.sendMessage(jid, {
          image: { url: video.thumbnail },
          caption: previewText
        }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text: previewText }, { quoted: msg });
      }

      await downloadVideo(video.url, filePath);

      if (!fs.existsSync(filePath)) throw new Error("Ficheiro de vídeo não foi criado");

      const sizeMB = fs.statSync(filePath).size / (1024 * 1024);
      if (sizeMB > 64) {
        return sock.sendMessage(jid, {
          text: `⚠️ Vídeo muito pesado (${sizeMB.toFixed(1)}MB). Tenta um vídeo mais curto.`
        }, { quoted: msg });
      }

      await sock.sendMessage(jid, {
        video: fs.readFileSync(filePath),
        mimetype: "video/mp4",
        caption: `🎥 ${video.title}`
      }, { quoted: msg });

    } catch (err) {
      console.error("[video] erro:", err.message);
      let m = "⚠️ Não consegui descarregar este vídeo.";
      if (err.message?.includes("timeout"))  m = "⏱️ O servidor demorou demasiado. Tenta novamente.";
      if (err.message?.includes("private"))  m = "🔒 Vídeo privado.";
      if (err.message?.includes("age"))      m = "🔞 Vídeo com restrição de idade.";
      await sock.sendMessage(jid, { text: m }, { quoted: msg });
    } finally {
      if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch {}
    }
  }
};
