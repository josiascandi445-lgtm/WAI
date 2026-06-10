import fs from "fs";
import sharp from "sharp";
import { downloadMediaMessage } from "@whiskeysockets/baileys";

export default {
  name: "sticker",
  aliases: ["s"],
  description: "Imagem → sticker",

  async execute({ sock, msg, jid }) {

    try {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      const isImage =
        msg.message?.imageMessage ||
        quoted?.imageMessage;

      if (!isImage) {
        return sock.sendMessage(jid, {
          text: "❌ Envia ou responde a uma imagem com .sticker"
        }, { quoted: msg });
      }

      const buffer = await downloadMediaMessage(
        msg,
        "buffer",
        {},
        {
          logger: console,
          reuploadRequest: sock.updateMediaMessage
        }
      );

      if (!buffer) {
        return sock.sendMessage(jid, {
          text: "❌ Falha ao descarregar imagem"
        }, { quoted: msg });
      }

      const dir = "./temp";
      if (!fs.existsSync(dir)) fs.mkdirSync(dir);

      const input = `${dir}/${Date.now()}.jpg`;
      const output = `${dir}/${Date.now()}.webp`;

      fs.writeFileSync(input, buffer);

      await sharp(input)
        .resize(512, 512, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .webp({ quality: 90 })
        .toFile(output);

      const stickerBuffer = fs.readFileSync(output);

      await sock.sendMessage(jid, {
        sticker: stickerBuffer
      }, { quoted: msg });

      fs.unlinkSync(input);
      fs.unlinkSync(output);

    } catch (err) {
      console.log("[sticker] erro:", err);

      await sock.sendMessage(jid, {
        text: "⚠️ erro ao criar sticker"
      }, { quoted: msg });
    }
  }
};
