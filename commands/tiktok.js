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
        ? "⬇️ A descarregar vídeo do TikTok..."
        : `🔎 A procurar no TikTok: *${query}*...`
    }, { quoted: msg });

    try {
      let videoUrl = query;
      let title = "Vídeo TikTok";

      if (!isUrl) {
        const result = await tiktokSearch(query);
        videoUrl = result.url;
        title    = result.title;

        const preview = `🎵 *${title}*\n👤 ${result.uploader}\n\n⬇️ A descarregar...`;
        if (result.thumbnail) {
          await sock.sendMessage(jid, { image: { url: result.thumbnail }, caption: preview }, { quoted: msg });
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
      if (err.message?.includes("timeout"))    m = "⏱️ O download demorou demasiado. Tenta novamente.";
      if (err.message?.includes("Nenhum"))     m = "❌ Não encontrei vídeos para essa pesquisa.";
      if (err.message?.includes("private"))    m = "🔒 Este vídeo é privado.";
      await sock.sendMessage(jid, { text: m }, { quoted: msg });
    } finally {
      if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch {}
    }
  }
};
