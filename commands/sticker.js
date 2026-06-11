/**
 * Comando: .sticker (ou .s)
 * FIX P9: corrigido download de imagem em mensagem citada.
 * O Baileys precisa da mensagem correcta para fazer download — quando
 * a imagem está numa resposta, temos de construir a mensagem correcta.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { downloadMediaMessage } from "@whiskeysockets/baileys";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_DIR = path.join(__dirname, "../tmp");

export default {
  name: "sticker",
  aliases: ["s"],
  description: "Converte imagem em sticker WebP",

  async execute({ sock, msg, jid }) {
    const timestamp = Date.now();
    const inputPath = path.join(TMP_DIR, `sticker_in_${timestamp}.jpg`);
    const outputPath = path.join(TMP_DIR, `sticker_out_${timestamp}.webp`);

    try {
      if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const hasDirectImage = !!msg.message?.imageMessage;
      const hasQuotedImage = !!quotedMsg?.imageMessage;

      if (!hasDirectImage && !hasQuotedImage) {
        return sock.sendMessage(jid, {
          text: "❌ Envia uma imagem com *.sticker*  ou  responde a uma imagem com *.s*"
        }, { quoted: msg });
      }

      let buffer;

      if (hasDirectImage) {
        // Imagem enviada diretamente com o comando
        buffer = await downloadMediaMessage(
          msg,
          "buffer",
          {},
          {
            logger: { info: () => {}, error: console.error, warn: () => {} },
            reuploadRequest: sock.updateMediaMessage,
          }
        );
      } else {
        // FIX P9: imagem está na mensagem CITADA — construir msg virtual para o download
        const quotedKey = msg.message.extendedTextMessage.contextInfo;
        const fakeMsg = {
          key: {
            remoteJid: jid,
            id: quotedKey.stanzaId,
            participant: quotedKey.participant,
          },
          message: quotedMsg,
        };

        buffer = await downloadMediaMessage(
          fakeMsg,
          "buffer",
          {},
          {
            logger: { info: () => {}, error: console.error, warn: () => {} },
            reuploadRequest: sock.updateMediaMessage,
          }
        );
      }

      if (!buffer || buffer.length === 0) {
        return sock.sendMessage(jid, {
          text: "❌ Falha ao descarregar imagem. Tenta reenviar."
        }, { quoted: msg });
      }

      fs.writeFileSync(inputPath, buffer);

      await sharp(inputPath)
        .resize(512, 512, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: 90 })
        .toFile(outputPath);

      const stickerBuffer = fs.readFileSync(outputPath);

      await sock.sendMessage(jid, { sticker: stickerBuffer }, { quoted: msg });

    } catch (err) {
      console.error("[sticker] erro:", err.message);
      await sock.sendMessage(jid, {
        text: "⚠️ Erro ao criar sticker. Certifica-te que é uma imagem válida (JPG/PNG)."
      }, { quoted: msg });
    } finally {
      for (const f of [inputPath, outputPath]) {
        if (fs.existsSync(f)) try { fs.unlinkSync(f); } catch {}
      }
    }
  }
};
