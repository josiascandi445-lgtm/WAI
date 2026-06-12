/**
 * Comando: .agendar / .agr
 * Agenda o reenvio de uma mensagem citada.
 *
 * Uso:
 *   .agr 2min       → envia daqui a 2 minutos
 *   .agr 30s        → envia daqui a 30 segundos
 *   .agr 1h         → envia daqui a 1 hora
 *   .agr 14:30      → envia às 14:30 de hoje (ou amanhã se já passou)
 *
 * Limite: 10 agendamentos activos por utilizador.
 * Os agendamentos são perdidos se o bot reiniciar (limitação de memória —
 * para persistência seria necessário base de dados).
 */
import { downloadMediaMessage } from "@whiskeysockets/baileys";

// agendamentos: Map<senderJid, Array<{timerId, scheduledFor}>>
const agendamentos = new Map();
const LIMITE_POR_USER = 10;

function parseDelay(str) {
  // Formato HH:MM
  const horaMatch = str.match(/^(\d{1,2}):(\d{2})$/);
  if (horaMatch) {
    const now = new Date();
    const target = new Date();
    target.setHours(Number(horaMatch[1]), Number(horaMatch[2]), 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1); // amanhã
    return { ms: target - now, label: str };
  }

  // Formato NNN s/min/h
  const durMatch = str.match(/^(\d+)(s|seg|min|h|hora|horas)$/i);
  if (durMatch) {
    const n = Number(durMatch[1]);
    const unit = durMatch[2].toLowerCase();
    const mult = unit === "s" || unit === "seg" ? 1000
               : unit === "min"                 ? 60_000
               :                                  3_600_000;
    return { ms: n * mult, label: str };
  }

  return null;
}

function fmt(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} segundo${s !== 1 ? "s" : ""}`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minuto${m !== 1 ? "s" : ""}`;
  const h = Math.floor(m / 60);
  return `${h} hora${h !== 1 ? "s" : ""}`;
}

export default {
  name: "agendar",
  aliases: ["agr"],
  description: "Agenda o reenvio de uma mensagem citada (.agr 2min / .agr 14:30)",

  async execute({ sock, jid, msg, sender, args }) {
    const ctx    = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = ctx?.quotedMessage;

    if (!quoted) {
      return sock.sendMessage(jid, {
        text: "❌ Responde a uma mensagem com *.agr <tempo>*\n\nExemplos:\n• .agr 2min\n• .agr 30s\n• .agr 1h\n• .agr 14:30"
      }, { quoted: msg });
    }

    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Indica o tempo. Ex: *.agr 5min*"
      }, { quoted: msg });
    }

    const parsed = parseDelay(args[0]);
    if (!parsed || parsed.ms < 5_000) {
      return sock.sendMessage(jid, {
        text: "❌ Tempo inválido. Exemplos: *2min*, *30s*, *1h*, *14:30*\nMínimo: 5 segundos."
      }, { quoted: msg });
    }

    if (parsed.ms > 86_400_000) {
      return sock.sendMessage(jid, {
        text: "❌ Máximo de 24 horas por agendamento."
      }, { quoted: msg });
    }

    // Verificar limite do utilizador
    const userAgend = agendamentos.get(sender) || [];
    if (userAgend.length >= LIMITE_POR_USER) {
      return sock.sendMessage(jid, {
        text: `⚠️ Já tens ${LIMITE_POR_USER} mensagens agendadas. Aguarda que sejam enviadas.`
      }, { quoted: msg });
    }

    // Capturar conteúdo da mensagem agora (antes do timeout)
    const fakeMsg = {
      key: { remoteJid: jid, id: ctx.stanzaId, participant: ctx.participant },
      message: quoted,
    };
    const msgType = Object.keys(quoted)[0];

    // Pré-descarregar média se necessário
    let mediaBuffer = null;
    const mediaTypes = ["imageMessage","videoMessage","audioMessage","stickerMessage","documentMessage"];
    if (mediaTypes.includes(msgType)) {
      try {
        mediaBuffer = await downloadMediaMessage(fakeMsg, "buffer", {}, {
          logger: { info: () => {}, error: console.error, warn: () => {} },
          reuploadRequest: sock.updateMediaMessage,
        });
      } catch (err) {
        return sock.sendMessage(jid, {
          text: "⚠️ Não consegui preparar o ficheiro para agendamento."
        }, { quoted: msg });
      }
    }

    // Confirmar agendamento
    await sock.sendMessage(jid, {
      text: `✅ *Mensagem agendada!*\n⏱️ Será enviada em *${fmt(parsed.ms)}*\n📋 Tens ${userAgend.length + 1}/${LIMITE_POR_USER} agendamentos activos.`
    }, { quoted: msg });

    const timerId = setTimeout(async () => {
      try {
        if (msgType === "conversation" || msgType === "extendedTextMessage") {
          const text = quoted.conversation || quoted.extendedTextMessage?.text || "";
          await sock.sendMessage(jid, { text: `🔔 _Mensagem agendada_\n\n${text}` });
        } else if (msgType === "imageMessage" && mediaBuffer) {
          await sock.sendMessage(jid, { image: mediaBuffer, caption: quoted.imageMessage?.caption || "" });
        } else if (msgType === "videoMessage" && mediaBuffer) {
          await sock.sendMessage(jid, { video: mediaBuffer, mimetype: "video/mp4", caption: quoted.videoMessage?.caption || "" });
        } else if (msgType === "audioMessage" && mediaBuffer) {
          await sock.sendMessage(jid, { audio: mediaBuffer, mimetype: "audio/mpeg", ptt: quoted.audioMessage?.ptt || false });
        } else if (msgType === "stickerMessage" && mediaBuffer) {
          await sock.sendMessage(jid, { sticker: mediaBuffer });
        } else if (msgType === "documentMessage" && mediaBuffer) {
          await sock.sendMessage(jid, { document: mediaBuffer, mimetype: quoted.documentMessage?.mimetype || "application/octet-stream", fileName: quoted.documentMessage?.fileName || "ficheiro" });
        }
      } catch (err) {
        console.error("[agendar] erro ao enviar mensagem agendada:", err.message);
      } finally {
        // Remove da lista do utilizador
        const list = agendamentos.get(sender) || [];
        agendamentos.set(sender, list.filter(a => a.timerId !== timerId));
      }
    }, parsed.ms);

    // Regista
    agendamentos.set(sender, [...userAgend, { timerId, scheduledFor: Date.now() + parsed.ms }]);
  }
};
