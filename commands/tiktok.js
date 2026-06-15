/**
 * Comando: .tiktok / .tk
 * Descarrega e envia vídeo do TikTok.
 *
 * Uso:
 *   .tk https://www.tiktok.com/@user/video/123  → URL directa
 *   .tk edit Messi                               → pesquisa por texto
 */
import { tiktokSearch, downloadTikTok } from "../lib/ytdlp.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_DIR = path.join(__dirname, "../tmp");

function fmt(s) {
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function isTikTokUrl(str) {
  return str.includes("tiktok.com") || str.includes("vm.tiktok") || str.includes("vt.tiktok");
}

export default {
  name: "tiktok",
  aliases: ["tk"],
  description: "Descarrega vídeo do TikTok (.tk URL  ou  .tk pesquisa)",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa:\n• *.tk <URL>* — URL directa do TikTok\n• *.tk edit Messi* — pesquisa por texto"
      }, { quoted: msg });
    }

    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
    const filePath = path.join(TMP_DIR, `tiktok_${Date.now()}.mp4`);

    const query = args.join(" ");
    const isUrl = isTikTokUrl(query);

    await sock.sendMessage(jid, {
      text: isUrl
        ? "⬇️ A descarregar vídeo TikTok..."
        : `🔎 A procurar no TikTok: *${query}*...`
    }, { quoted: msg });

    try {
      let videoUrl = query;
      let title = "Vídeo TikTok";
      let thumbnail = null;
      let duration = 0;

      if (!isUrl) {
        // Pesquisa por texto
        const result = await tiktokSearch(query);
        videoUrl  = result.url;
        title     = result.title;
        thumbnail = result.thumbnail;
        duration  = result.duration;

        // Preview antes do download
        const preview = `🎵 *${title}*\n👤 ${result.uploader}${duration ? `\n⏱️ ${fmt(duration)}` : ""}\n\n⬇️ A descarregar...`;
        if (thumbnail) {
          await sock.sendMessage(jid, { image: { url: thumbnail }, caption: preview }, { quoted: msg });
        } else {
          await sock.sendMessage(jid, { text: preview }, { quoted: msg });
        }
      }

      await downloadTikTok(videoUrl, filePath);

      if (!fs.existsSync(filePath)) throw new Error("Ficheiro não criado");

      const sizeMB = fs.statSync(filePath).size / (1024 * 1024);
      if (sizeMB > 64) {
        return sock.sendMessage(jid, {
          text: `⚠️ Vídeo demasiado pesado (${sizeMB.toFixed(1)}MB). O WhatsApp aceita até 64MB.`
        }, { quoted: msg });
      }

      await sock.sendMessage(jid, {
        video: fs.readFileSync(filePath),
        mimetype: "video/mp4",
        caption: `🎵 ${title}`
      }, { quoted: msg });

    } catch (err) {
      console.error("[tiktok] erro:", err.message);
      let m = "⚠️ Não consegui descarregar este vídeo do TikTok.";
      if (err.message?.includes("timeout")) m = "⏱️ O download demorou demasiado. Tenta um vídeo mais curto.";
      if (err.message?.includes("private")) m = "🔒 Este vídeo é privado.";
      if (err.message?.includes("login"))   m = "🔒 Este vídeo requer login no TikTok.";
      await sock.sendMessage(jid, { text: m }, { quoted: msg });
    } finally {
      if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch {}
    }
  }
};
