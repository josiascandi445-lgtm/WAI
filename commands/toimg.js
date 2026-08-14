/**
 * commands/toimg.js
 *
 * .toimg — responde a um sticker para o converter de volta:
 *   - sticker ESTÁTICO → imagem (PNG)
 *   - sticker ANIMADO   → vídeo (MP4, com reprodução em loop tipo GIF)
 *
 * Reaproveita o ffmpeg já usado no sistema de downloads (bin/ffmpeg,
 * ver lib/media/ytdlp.js) para a conversão de animados — nenhuma
 * dependência nova.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import sharp from "sharp";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { getFfmpegBinary } from "../lib/media/ytdlp.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_DIR   = path.join(__dirname, "../tmp");

function ensureTmp() {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
}

/** Converte um webp animado em mp4 (loop tipo GIF) via ffmpeg. */
function convertWebpToMp4(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      "-y", "-i", inputPath,
      "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
      "-movflags", "faststart",
      "-pix_fmt", "yuv420p",
      "-vcodec", "libx264",
      outputPath,
    ];

    const proc = spawn(getFfmpegBinary(), args);
    let stderr = "";
    proc.stderr.on("data", d => { stderr += d; });

    const timer = setTimeout(() => {
      try { proc.kill("SIGKILL"); } catch {}
      reject(new Error("ffmpeg demorou demasiado (timeout)"));
    }, 60_000);

    proc.on("close", code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`ffmpeg falhou: ${stderr.slice(0, 300)}`));
      if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 100) {
        return reject(new Error("ffmpeg não produziu um ficheiro válido"));
      }
      resolve();
    });
  });
}

export default {
  name: "toimg",
  aliases: ["toimage", "sticker2img"],
  description: "Converte um sticker em imagem (ou vídeo, se for animado) — responde a um sticker com .toimg",

  async execute({ sock, jid, msg }) {
    const ctx     = msg.message?.extendedTextMessage?.contextInfo;
    const quoted  = ctx?.quotedMessage;
    const direct  = msg.message?.stickerMessage;
    const fromQuoted = quoted?.stickerMessage;

    if (!direct && !fromQuoted) {
      return sock.sendMessage(jid, {
        text: "❌ Responde a um sticker com *.toimg* para o converter.",
      }, { quoted: msg });
    }

    const stickerMsg = direct || fromQuoted;
    const isAnimated = !!stickerMsg.isAnimated;
    const loggerSilent = { info: () => {}, error: console.error, warn: () => {} };

    let inputPath, outputPath;

    try {
      let buf;
      if (direct) {
        buf = await downloadMediaMessage(msg, "buffer", {}, { logger: loggerSilent, reuploadRequest: sock.updateMediaMessage });
      } else {
        const fakeMsg = {
          key: { remoteJid: jid, id: ctx.stanzaId, participant: ctx.participant },
          message: quoted,
        };
        buf = await downloadMediaMessage(fakeMsg, "buffer", {}, { logger: loggerSilent, reuploadRequest: sock.updateMediaMessage });
      }

      if (!buf || buf.length === 0) throw new Error("Falha ao descarregar o sticker");

      if (!isAnimated) {
        const png = await sharp(buf).png().toBuffer();
        await sock.sendMessage(jid, { image: png }, { quoted: msg });
        console.log("[toimg] ✅ sticker estático → imagem");
        return;
      }

      // Animado: converte via ffmpeg para mp4 (enviado como "vídeo" com
      // gifPlayback — é assim que o WhatsApp mostra GIFs, em loop curto).
      ensureTmp();
      const stamp = Date.now();
      inputPath  = path.join(TMP_DIR, `toimg_${stamp}.webp`);
      outputPath = path.join(TMP_DIR, `toimg_${stamp}.mp4`);

      fs.writeFileSync(inputPath, buf);
      await convertWebpToMp4(inputPath, outputPath);

      const videoBuf = fs.readFileSync(outputPath);
      await sock.sendMessage(jid, { video: videoBuf, gifPlayback: true }, { quoted: msg });
      console.log("[toimg] ✅ sticker animado → vídeo (gif)");

    } catch (err) {
      console.error("[toimg] erro:", err.message);
      await sock.sendMessage(jid, {
        text: "⚠️ Não consegui converter este sticker.",
      }, { quoted: msg });
    } finally {
      if (inputPath && fs.existsSync(inputPath)) try { fs.unlinkSync(inputPath); } catch {}
      if (outputPath && fs.existsSync(outputPath)) try { fs.unlinkSync(outputPath); } catch {}
    }
  },
};
