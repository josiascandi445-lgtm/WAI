/**
 * Comando: .sticker (ou .s)
 * Converte imagem enviada/respondida em sticker WebP.
 * CORREÇÃO: sharp estava a ser usado mas não declarado no package.json.
 *           Agora está declarado como dependência.
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
  description: "Converte imagem em sticker",

  async execute({ sock, msg, jid }) {
    // timestamp declarado fora do try para o finally conseguir limpar
    const timestamp = Date.now();
    const inputPath = path.join(TMP_DIR, `sticker_in_${timestamp}.jpg`);
    const outputPath = path.join(TMP_DIR, `sticker_out_${timestamp}.webp`);

    try {
      // Suporta: imagem direta OU imagem em mensagem respondida
      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const hasDirectImage = !!msg.message?.imageMessage;
      const hasQuotedImage = !!quotedMsg?.imageMessage;

      if (!hasDirectImage && !hasQuotedImage) {
        return sock.sendMessage(jid, {
          text: "❌ Envia uma imagem com .sticker  ou  responde a uma imagem com .s"
        }, { quoted: msg });
      }

      // Garante pasta tmp
      if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

      // Download da imagem
      const buffer = await downloadMediaMessage(
        msg,
        "buffer",
        {},
        {
          logger: { info: () => {}, error: console.error, warn: () => {} },
          reuploadRequest: sock.updateMediaMessage
        }
      );

      if (!buffer || buffer.length === 0) {
        return sock.sendMessage(jid, {
          text: "❌ Falha ao descarregar imagem."
        }, { quoted: msg });
      }

      fs.writeFileSync(inputPath, buffer);

      // Converte para WebP 512x512 com fundo transparente
      await sharp(inputPath)
        .resize(512, 512, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .webp({ quality: 90 })
        .toFile(outputPath);

      const stickerBuffer = fs.readFileSync(outputPath);

      await sock.sendMessage(jid, {
        sticker: stickerBuffer
      }, { quoted: msg });

    } catch (err) {
      console.error("[sticker] erro:", err.message);
      await sock.sendMessage(jid, {
        text: "⚠️ Erro ao criar sticker. Certifica-te que é uma imagem válida."
      }, { quoted: msg });
    } finally {
      // Cleanup garantido
      for (const f of [inputPath, outputPath]) {
        if (fs.existsSync(f)) try { fs.unlinkSync(f); } catch {}
      }
    }
  }
};
