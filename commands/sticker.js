/**
 * Comando: .sticker (ou .s)
 * Converte imagem, vídeo (até 10s) ou GIF em sticker.
 *
 * - Imagem  → sticker estático (sharp, como já era)
 * - Vídeo/GIF → sticker animado (wa-sticker-formatter, já usado no
 *   .take — sabe tratar vídeo/GIF sozinho, sem precisarmos de escrever
 *   nenhuma conversão de ffmpeg à mão).
 *
 * NOTA sobre GIFs: o WhatsApp não tem um tipo de mensagem "GIF" próprio —
 * o que aparece como GIF é sempre um videoMessage com a flag
 * gifPlayback=true. É por isso que "vídeo" e "GIF" são tratados aqui
 * pelo mesmo caminho de código.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { Sticker, StickerTypes } from "wa-sticker-formatter";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_DIR = path.join(__dirname, "../tmp");
const MAX_VIDEO_SECONDS = 10;

function buildFakeMsg(jid, ctx, quotedMsg) {
  return {
    key: { remoteJid: jid, id: ctx.stanzaId, participant: ctx.participant },
    message: quotedMsg,
  };
}

export default {
  name: "sticker",
  aliases: ["s"],
  description: "Converte imagem, vídeo (até 10s) ou GIF em sticker",

  async execute({ sock, msg, jid, sender }) {
    const timestamp = Date.now();
    const outputPath = path.join(TMP_DIR, `sticker_out_${timestamp}.webp`);

    try {
      if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

      const ctx = msg.message?.extendedTextMessage?.contextInfo;
      const quotedMsg = ctx?.quotedMessage;

      const hasDirectImage = !!msg.message?.imageMessage;
      const hasQuotedImage = !!quotedMsg?.imageMessage;
      const directVideo  = msg.message?.videoMessage;
      const quotedVideo  = quotedMsg?.videoMessage;
      const hasVideo = !!(directVideo || quotedVideo);

      if (!hasDirectImage && !hasQuotedImage && !hasVideo) {
        return sock.sendMessage(jid, {
          text:
            "❌ Envia (ou responde a) uma imagem, vídeo (até 10s) ou GIF com *.sticker*/*.s*",
        }, { quoted: msg });
      }

      // Vídeo/GIF: valida a duração ANTES de descarregar, quando o
      // WhatsApp nos dá essa informação (nem sempre vem preenchida).
      if (hasVideo) {
        const videoInfo = directVideo || quotedVideo;
        if (videoInfo.seconds && videoInfo.seconds > MAX_VIDEO_SECONDS) {
          return sock.sendMessage(jid, {
            text: `❌ Vídeo demasiado longo (${videoInfo.seconds}s). Máximo: ${MAX_VIDEO_SECONDS}s.`,
          }, { quoted: msg });
        }
      }

      const loggerSilent = { info: () => {}, error: console.error, warn: () => {} };
      let buffer;

      if (hasDirectImage || directVideo) {
        buffer = await downloadMediaMessage(msg, "buffer", {}, {
          logger: loggerSilent,
          reuploadRequest: sock.updateMediaMessage,
        });
      } else {
        const fakeMsg = buildFakeMsg(jid, ctx, quotedMsg);
        buffer = await downloadMediaMessage(fakeMsg, "buffer", {}, {
          logger: loggerSilent,
          reuploadRequest: sock.updateMediaMessage,
        });
      }

      if (!buffer || buffer.length === 0) {
        return sock.sendMessage(jid, {
          text: "❌ Falha ao descarregar. Tenta reenviar.",
        }, { quoted: msg });
      }

      let stickerBuffer;

      if (hasVideo) {
        // wa-sticker-formatter detecta que é vídeo/GIF sozinho e produz
        // um webp animado — mesmo mecanismo já usado no .take.
        const numero = sender.split("@")[0];
        const sticker = new Sticker(buffer, {
          pack: "WAI Bot",
          author: msg.pushName || `+${numero}`,
          type: StickerTypes.FULL,
          quality: 60, // vídeos/GIFs pesam mais — qualidade um pouco mais baixa mantém o sticker leve
        });
        stickerBuffer = await sticker.toBuffer();
      } else {
        // Imagem estática — caminho já existente, inalterado.
        stickerBuffer = await sharp(buffer)
          .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .webp({ quality: 90 })
          .toBuffer();
      }

      await sock.sendMessage(jid, { sticker: stickerBuffer }, { quoted: msg });
      console.log(`[sticker] ✅ ${hasVideo ? "vídeo/gif" : "imagem"} → sticker`);

    } catch (err) {
      console.error("[sticker] erro:", err.message);
      await sock.sendMessage(jid, {
        text: "⚠️ Erro ao criar sticker. Certifica-te que é uma imagem, vídeo (até 10s) ou GIF válido.",
      }, { quoted: msg });
    } finally {
      if (fs.existsSync(outputPath)) try { fs.unlinkSync(outputPath); } catch {}
    }
  },
};
