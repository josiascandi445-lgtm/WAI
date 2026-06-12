/**
 * Comando: .repost / .r
 * Reenvia a mensagem que estás a citar, no mesmo chat.
 * Suporta: texto, imagem, vídeo, áudio, sticker, documento.
 */
import { downloadMediaMessage } from "@whiskeysockets/baileys";

export default {
  name: "repost",
  aliases: ["r"],
  description: "Reenvia a mensagem citada no chat actual",

  async execute({ sock, jid, msg }) {
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = ctx?.quotedMessage;

    if (!quoted) {
      return sock.sendMessage(jid, {
        text: "❌ Responde a uma mensagem com *.repost* para a reenviar.\nAliás curto: *.r*"
      }, { quoted: msg });
    }

    const fakeMsg = {
      key: { remoteJid: jid, id: ctx.stanzaId, participant: ctx.participant },
      message: quoted,
    };

    const msgType = Object.keys(quoted)[0];

    try {
      // ── Texto ─────────────────────────────────────────────────────
      if (msgType === "conversation" || msgType === "extendedTextMessage") {
        const text = quoted.conversation || quoted.extendedTextMessage?.text || "";
        return sock.sendMessage(jid, { text: `🔁 _Repost_\n\n${text}` });
      }

      // ── Imagem ────────────────────────────────────────────────────
      if (msgType === "imageMessage") {
        const buf = await downloadMediaMessage(fakeMsg, "buffer", {}, {
          logger: { info: () => {}, error: console.error, warn: () => {} },
          reuploadRequest: sock.updateMediaMessage,
        });
        return sock.sendMessage(jid, {
          image: buf,
          caption: quoted.imageMessage?.caption || "",
        });
      }

      // ── Vídeo ─────────────────────────────────────────────────────
      if (msgType === "videoMessage") {
        const buf = await downloadMediaMessage(fakeMsg, "buffer", {}, {
          logger: { info: () => {}, error: console.error, warn: () => {} },
          reuploadRequest: sock.updateMediaMessage,
        });
        return sock.sendMessage(jid, {
          video: buf,
          caption: quoted.videoMessage?.caption || "",
          mimetype: "video/mp4",
        });
      }

      // ── Áudio / PTT ───────────────────────────────────────────────
      if (msgType === "audioMessage") {
        const buf = await downloadMediaMessage(fakeMsg, "buffer", {}, {
          logger: { info: () => {}, error: console.error, warn: () => {} },
          reuploadRequest: sock.updateMediaMessage,
        });
        return sock.sendMessage(jid, {
          audio: buf,
          mimetype: "audio/mpeg",
          ptt: quoted.audioMessage?.ptt || false,
        });
      }

      // ── Sticker ───────────────────────────────────────────────────
      if (msgType === "stickerMessage") {
        const buf = await downloadMediaMessage(fakeMsg, "buffer", {}, {
          logger: { info: () => {}, error: console.error, warn: () => {} },
          reuploadRequest: sock.updateMediaMessage,
        });
        return sock.sendMessage(jid, { sticker: buf });
      }

      // ── Documento ─────────────────────────────────────────────────
      if (msgType === "documentMessage") {
        const buf = await downloadMediaMessage(fakeMsg, "buffer", {}, {
          logger: { info: () => {}, error: console.error, warn: () => {} },
          reuploadRequest: sock.updateMediaMessage,
        });
        return sock.sendMessage(jid, {
          document: buf,
          mimetype: quoted.documentMessage?.mimetype || "application/octet-stream",
          fileName: quoted.documentMessage?.fileName || "ficheiro",
        });
      }

      await sock.sendMessage(jid, {
        text: "⚠️ Tipo de mensagem não suportado para repost."
      }, { quoted: msg });

    } catch (err) {
      console.error("[repost] erro:", err.message);
      await sock.sendMessage(jid, {
        text: "⚠️ Não consegui reenviar esta mensagem."
      }, { quoted: msg });
    }
  }
};
