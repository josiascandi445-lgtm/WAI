/**
 * Comando: .video <nome>
 * Baixa e envia vídeo do YouTube.
 * CORREÇÃO: migrado para @distube/ytdl-core.
 * CORREÇÃO: cleanup do ficheiro temporário também em caso de erro.
 */
import ytdl from "@distube/ytdl-core";
import yts from "yt-search";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_DIR = path.join(__dirname, "../tmp");

export default {
  name: "video",
  aliases: ["vid"],
  description: "Baixa e envia vídeo do YouTube",

  async execute({ sock, jid, msg, args }) {
    const query = args.join(" ");

    if (!query) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .video nome do vídeo"
      }, { quoted: msg });
    }

    await sock.sendMessage(jid, {
      text: `🔎 A procurar vídeo: *${query}*...`
    }, { quoted: msg });

    // Garante pasta tmp
    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

    const filePath = path.join(TMP_DIR, `video_${Date.now()}.mp4`);

    try {
      const search = await yts(query);
      const video = search.videos?.[0];

      if (!video) {
        return sock.sendMessage(jid, {
          text: "❌ Nenhum vídeo encontrado."
        }, { quoted: msg });
      }

      // Rejeita vídeos longos (>5 min) para evitar ficheiros enormes
      if (video.seconds > 300) {
        return sock.sendMessage(jid, {
          text: `⚠️ Vídeo demasiado longo (${video.timestamp}). Máximo: 5 minutos.`
        }, { quoted: msg });
      }

      await sock.sendMessage(jid, {
        text: `🎥 *${video.title}*\n⏱️ ${video.timestamp}\n\n⬇️ A descarregar...`
      }, { quoted: msg });

      if (!ytdl.validateURL(video.url)) {
        return sock.sendMessage(jid, {
          text: "❌ URL inválida."
        }, { quoted: msg });
      }

      // Download para ficheiro
      await new Promise((resolve, reject) => {
        const stream = ytdl(video.url, {
          filter: "audioandvideo",
          quality: "lowest",
          requestOptions: {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
          }
        });

        const writeStream = fs.createWriteStream(filePath);
        stream.pipe(writeStream);

        // FIX: propaga erro do stream para a Promise
        stream.on("error", reject);
        writeStream.on("error", reject);
        writeStream.on("finish", resolve);
      });

      const stats = fs.statSync(filePath);
      const sizeMB = stats.size / (1024 * 1024);

      if (sizeMB > 64) {
        // FIX: cleanup antes de sair
        fs.unlinkSync(filePath);
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

      let errMsg = "💥 Erro ao baixar vídeo.";
      if (err.message?.includes("age") || err.message?.includes("sign")) {
        errMsg = "⚠️ Vídeo com restrição de idade.";
      } else if (err.message?.includes("unavailable")) {
        errMsg = "⚠️ Vídeo indisponível.";
      }

      await sock.sendMessage(jid, { text: errMsg }, { quoted: msg });
    } finally {
      // FIX: cleanup garantido em qualquer caso (sucesso ou erro)
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch {}
      }
    }
  }
};
