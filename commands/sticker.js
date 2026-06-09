import fs from "fs";
import sharp from "sharp";

export default {
  name: "sticker",
  aliases: ["s"],
  description: "Imagem → sticker",

  async execute({ sock, msg, jid }) {
    try {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      const imageMessage =
        msg.message?.imageMessage ||
        quoted?.imageMessage;

      if (!imageMessage) {
        return sock.sendMessage(jid, {
          text: "❌ Envia ou responde a uma imagem com .sticker"
        }, { quoted: msg });
      }

      // 🔥 ISTO é o correto no Baileys
      const buffer = await sock.downloadMediaMessage(msg, "buffer");

      if (!buffer) {
        return sock.sendMessage(jid, {
          text: "❌ Não consegui ler a imagem."
        }, { quoted: msg });
      }

      const input = `./temp/${Date.now()}.jpg`;
      const output = `./temp/${Date.now()}.webp`;

      fs.mkdirSync("./temp", { recursive: true });

      fs.writeFileSync(input, buffer);

      await sharp(input)
        .resize(512, 512, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .webp({ quality: 80 })
        .toFile(output);

      await sock.sendMessage(jid, {
        sticker: fs.readFileSync(output)
      });

      fs.unlinkSync(input);
      fs.unlinkSync(output);

    } catch (err) {
      console.error("[sticker] erro real:", err);

      await sock.sendMessage(jid, {
        text: "⚠️ Falha ao criar sticker (ver logs)"
      }, { quoted: msg });
    }
  }
};
