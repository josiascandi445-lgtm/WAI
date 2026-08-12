/**
 * commands/on.js
 *
 * Reactiva o bot globalmente. Único comando que continua a funcionar
 * mesmo com o bot desligado (ver o gate em handlers/onMessage.js) —
 * caso contrário o dono nunca conseguiria voltar a ligá-lo.
 *
 * Permitido a: dono do bot, ou administradores do grupo (se usado
 * dentro de um grupo) — adicionado a pedido, além da correcção do bug
 * em que o próprio dono era recusado (ver isOwner em groupUtils.js).
 */
import { isOwner, isAdmin } from "../lib/groupUtils.js";
import { isBotEnabled, setBotEnabled } from "../lib/botState.js";

export default {
  name: "on",
  description: "Reactiva o bot (dono ou admins do grupo)",

  async execute({ sock, jid, msg, sender, rawSender, isGroup }) {
    const owner = await isOwner(sender, sock);
    const admin = isGroup && (await isAdmin(sock, jid, rawSender ?? sender));

    if (!owner && !admin) {
      return sock.sendMessage(jid, { text: "❌ Só o dono do bot ou administradores do grupo podem usar este comando." }, { quoted: msg });
    }

    if (isBotEnabled()) {
      return sock.sendMessage(jid, { text: "ℹ️ O bot já está ligado." }, { quoted: msg });
    }

    setBotEnabled(true);
    await sock.sendMessage(jid, {
      text: "✅ *Bot reactivado!* Voltei a responder normalmente. 🤖",
    }, { quoted: msg });
  },
};
