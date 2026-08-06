/**
 * commands/off.js
 *
 * Desactiva o bot globalmente — depois disto, o bot ignora tudo (não
 * responde a comandos, não envia despedidas nem mensagens do ADD RACE)
 * até que o dono use .on outra vez. Ver o gate em handlers/onMessage.js
 * e handlers/onGroupParticipantsUpdate.js.
 */
import { isOwner } from "../lib/groupUtils.js";
import { isBotEnabled, setBotEnabled } from "../lib/botState.js";

export default {
  name: "off",
  description: "Desactiva o bot (só o dono)",

  async execute({ sock, jid, msg, sender }) {
    if (!isOwner(sender)) {
      return sock.sendMessage(jid, { text: "❌ Só o dono do bot pode usar este comando." }, { quoted: msg });
    }

    if (!isBotEnabled()) {
      return sock.sendMessage(jid, { text: "ℹ️ O bot já está desligado." }, { quoted: msg });
    }

    // Confirma ANTES de desligar — senão esta própria mensagem seria a
    // última coisa que o bot enviaria e o dono ficaria sem confirmação.
    await sock.sendMessage(jid, {
      text: "🛑 *Bot desactivado.* Deixo de responder a tudo até usares *.on* outra vez.",
    }, { quoted: msg });

    setBotEnabled(false);
  },
};
