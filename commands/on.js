/**
 * commands/on.js
 *
 * Reactiva o bot globalmente. Único comando que continua a funcionar
 * mesmo com o bot desligado (ver o gate em handlers/onMessage.js) —
 * caso contrário o dono nunca conseguiria voltar a ligá-lo.
 */
import { isOwner } from "../lib/groupUtils.js";
import { isBotEnabled, setBotEnabled } from "../lib/botState.js";

export default {
  name: "on",
  description: "Reactiva o bot (só o dono)",

  async execute({ sock, jid, msg, sender }) {
    if (!(await isOwner(sender, sock))) {
      return sock.sendMessage(jid, { text: "❌ Só o dono do bot pode usar este comando." }, { quoted: msg });
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
