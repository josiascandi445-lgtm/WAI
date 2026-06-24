/**
 * Comando: .take
 * Altera o nome do pacote (autor) do sticker para o nome de quem usou o comando.
 * Responde a um sticker com .take
 */
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import sharp from "sharp";

export default {
  name: "take",
  description: "Altera o nome do sticker para o teu nome (responde a um sticker com .take)",

  async execute({ sock, jid, msg, sender }) {
    const ctx    = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = ctx?.quotedMessage;
    const hasDirectSticker = !!msg.message?.stickerMessage;
    const hasQuotedSticker = !!quoted?.stickerMessage;

    if (!hasDirectSticker && !hasQuotedSticker) {
      return sock.sendMessage(jid, {
        text: "❌ Responde a um sticker com *.take* para alterar o autor."
      }, { quoted: msg });
    }

    const numero = sender.split("@")[0];

    console.log(`[take] A processar sticker para: ${numero}`);

    const loggerSilent = { info: () => {}, error: console.error, warn: () => {} };

    try {
      let buf;

      if (hasDirectSticker) {
        buf = await downloadMediaMessage(msg, "buffer", {}, {
          logger: loggerSilent,
          reuploadRequest: sock.updateMediaMessage,
        });
      } else {
        const fakeMsg = {
          key: { remoteJid: jid, id: ctx.stanzaId, participant: ctx.participant },
          message: quoted,
        };
        buf = await downloadMediaMessage(fakeMsg, "buffer", {}, {
          logger: loggerSilent,
          reuploadRequest: sock.updateMediaMessage,
        });
      }

      if (!buf || buf.length === 0) throw new Error("Falha ao descarregar sticker");

      // Re-processa o sticker com sharp para WebP, incorporando metadados de exif
      // com o nome de autor actualizado. O WhatsApp lê o campo "author" dos
      // metadados exif do WebP para mostrar o nome do pacote.
      const output = await sharp(buf)
        .webp({ quality: 90 })
        .withMetadata({
          exif: {
            IFD0: {
              ImageDescription: numero,
              Artist: numero,
              Software: "WAI Bot",
            }
          }
        })
        .toBuffer();

      await sock.sendMessage(jid, { sticker: output }, { quoted: msg });
      console.log(`[take] ✅ sticker reenviado com autor "${numero}"`);

    } catch (err) {
      console.error(`[take] erro: ${err.message}`);
      await sock.sendMessage(jid, {
        text: "⚠️ Não consegui processar este sticker."
      }, { quoted: msg });
    }
  }
};
