/**
 * Comando: .revelar / .r
 * Revela o conteúdo de uma mensagem de visualização única (viewOnce).
 * Responde à mensagem viewOnce com .revelar e o bot envia o conteúdo normalmente.
 */
import { downloadMediaMessage } from "@whiskeysockets/baileys";

export default {
  name: "revelar",
  aliases: ["reveal"],
  description: "Revela foto ou vídeo de visualização única (responde com .revelar)",

  async execute({ sock, jid, msg }) {
    const ctx     = msg.message?.extendedTextMessage?.contextInfo;
    const quoted  = ctx?.quotedMessage;

    // Detecta viewOnce em qualquer variante
    const viewOnce =
      quoted?.viewOnceMessage?.message ||
      quoted?.viewOnceMessageV2?.message ||
      quoted?.viewOnceMessageV2Extension?.message ||
      null;

    if (!viewOnce) {
      return sock.sendMessage(jid, {
        text: "❌ Responde a uma mensagem de visualização única com *.revelar*"
      }, { quoted: msg });
    }

    const msgType = Object.keys(viewOnce)[0];
    console.log(`[revelar] tipo detectado: ${msgType}`);

    const fakeMsg = {
      key: { remoteJid: jid, id: ctx.stanzaId, participant: ctx.participant },
      message: viewOnce,
    };

    const loggerSilent = { info: () => {}, error: console.error, warn: () => {} };

    try {
      if (msgType === "imageMessage") {
        const buf = await downloadMediaMessage(fakeMsg, "buffer", {}, {
          logger: loggerSilent,
          reuploadRequest: sock.updateMediaMessage,
        });
        await sock.sendMessage(jid, { image: buf, caption: "📸 Imagem revelada" }, { quoted: msg });

      } else if (msgType === "videoMessage") {
        const buf = await downloadMediaMessage(fakeMsg, "buffer", {}, {
          logger: loggerSilent,
          reuploadRequest: sock.updateMediaMessage,
        });
        await sock.sendMessage(jid, { video: buf, mimetype: "video/mp4", caption: "🎥 Vídeo revelado" }, { quoted: msg });

      } else {
        await sock.sendMessage(jid, {
          text: `⚠️ Tipo de mensagem não suportado para revelar: ${msgType}`
        }, { quoted: msg });
      }

    } catch (err) {
      console.error(`[revelar] erro: ${err.message}`);
      await sock.sendMessage(jid, {
        text: "⚠️ Não consegui revelar esta mensagem. Pode ter expirado."
      }, { quoted: msg });
    }
  }
};
