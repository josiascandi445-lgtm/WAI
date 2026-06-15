import { isAdmin, isBotAdmin, findParticipantJid } from "../lib/groupUtils.js";

export default {
  name: "ban",
  description: "Remove membro do grupo (bot precisa de ser admin)",

  async execute({ sock, jid, msg, sender, rawSender, args, isGroup }) {
    if (!isGroup) {
      return sock.sendMessage(jid, { text: "❌ Este comando só funciona em grupos." }, { quoted: msg });
    }

    // Verificar se quem usa é admin
    const senderIsAdmin = await isAdmin(sock, jid, rawSender ?? sender);
    if (!senderIsAdmin) {
      return sock.sendMessage(jid, { text: "❌ Só os administradores podem usar este comando." }, { quoted: msg });
    }

    // Verificar se o bot é admin
    const botIsAdmin = await isBotAdmin(sock, jid);
    if (!botIsAdmin) {
      return sock.sendMessage(jid, { text: "⚠️ Preciso de ser admin para remover membros." }, { quoted: msg });
    }

    // Determinar alvo (menção ou número)
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
    let targetJid = mentioned[0] ?? null;

    if (!targetJid && args.length) {
      const num = args[0].replace(/[^0-9]/g, "");
      if (num) targetJid = await findParticipantJid(sock, jid, num) ?? `${num}@s.whatsapp.net`;
    }

    if (!targetJid) {
      return sock.sendMessage(jid, { text: "❌ Usa: .ban @utilizador  ou  .ban 244912345678" }, { quoted: msg });
    }

    try {
      await sock.groupParticipantsUpdate(jid, [targetJid], "remove");
      await sock.sendMessage(jid, {
        text: `🚫 *${targetJid.split("@")[0]}* foi removido do grupo.`
      }, { quoted: msg });
    } catch (err) {
      console.error("[ban] erro:", err.message);
      await sock.sendMessage(jid, { text: `⚠️ Não consegui remover: ${err.message}` }, { quoted: msg });
    }
  }
};
