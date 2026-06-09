import fs from "fs";
import path from "path";
import sharp from "sharp";

export default {
  name: "sticker",
  aliases: ["s", "fig", "st"],
  description: "Transforma imagem em sticker",

  async execute({ sock, msg, jid }) {
    const message = msg.message;

    // tenta pegar imagem enviada ou quoted
    const image =
      message?.imageMessage ||
      message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;

    if (!image) {
      return sock.sendMessage(
        jid,
        {
          text: "❌ Envia ou responde a uma imagem com .sticker",
        },
        { quoted: msg }
      );
    }

    try {
      // baixa a imagem
      const stream = await sock.downloadMediaMessage(msg);
      if (!stream) throw new Error("Falha ao baixar imagem");

      const inputPath = `./temp/${Date.now()}.jpg`;
      const outputPath = `./temp/${Date.now()}.webp`;

      fs.mkdirSync("./temp", { recursive: true });

      fs.writeFileSync(inputPath, stream);

      // converte para sticker (WEBP)
      await sharp(inputPath)
        .resize(512, 512, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: 80 })
        .toFile(outputPath);

      // envia sticker
      await sock.sendMessage(jid, {
        sticker: fs.readFileSync(outputPath),
      });

      // limpa ficheiros
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);

    } catch (err) {
      console.error("[sticker] erro:", err);

      await sock.sendMessage(
        jid,
        {
          text: "⚠️ Falha ao criar sticker.",
        },
        { quoted: msg }
      );
    }
  },
};
