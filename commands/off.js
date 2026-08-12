/**
 * commands/off.js
 *
 * Desactiva o bot globalmente — depois disto, o bot ignora tudo (não
 * responde a comandos, não envia despedidas nem mensagens do ADD RACE)
 * até que o dono (ou um admin) use .on outra vez.
 *
 * Permitido a: dono do bot, ou administradores do grupo (se usado
 * dentro de um grupo) — adicionado a pedido, além da correcção do bug
 * em que o próprio dono era recusado (ver isOwner em groupUtils.js).
 */
import { isOwner, isAdmin } from "../lib/groupUtils.js";
import { isBotEnabled, setBotEnabled } from "../lib/botState.js";

export default {
  name: "off",
  description: "Desactiva o bot (dono ou admins do grupo)",

  async execute({ sock, jid, msg, sender, rawSender, isGroup }) {
    const owner = await isOwner(sender, sock);
    const admin = isGroup && (await isAdmin(sock, jid, rawSender ?? sender));

    if (!owner && !admin) {
      return sock.sendMessage(jid, { text: "❌ Só o dono do bot ou administradores do grupo podem usar este comando." }, { quoted: msg });
    }

    if (!isBotEnabled()) {
      return sock.sendMessage(jid, { text: "ℹ️ O bot já está desligado." }, { quoted: msg });
    }

    await sock.sendMessage(jid, {
      text: "🛑 *Bot desactivado.* Deixo de responder a tudo até usares *.on* outra vez.",
    }, { quoted: msg });

    setBotEnabled(false);
  },
};
