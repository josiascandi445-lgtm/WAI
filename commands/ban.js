/**
 * Comando: .ban @utilizador
 * Remove um participante do grupo (requer que o bot seja admin).
 *
 * NOTA: Este ficheiro foi corrigido — a versão anterior continha
 * uma cópia duplicada do handler de mensagens (onMessage), o que
 * causava conflito de estado e comportamento imprevisível.
 */
export default {
  name: "ban",
  description: "Remove membro do grupo (bot precisa de ser admin)",

  async execute({ sock, jid, msg, args, isGroup }) {
    if (!isGroup) {
      return sock.sendMessage(jid, {
        text: "❌ Este comando só funciona em grupos."
      }, { quoted: msg });
    }

    // Suporta menção (@user) ou número direto
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
    let targetJid = mentioned[0] ?? null;

    if (!targetJid && args.length) {
      const number = args[0].replace(/[^0-9]/g, "");
      if (number) targetJid = number + "@s.whatsapp.net";
    }

    if (!targetJid) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .ban @utilizador  ou  .ban 244912345678"
      }, { quoted: msg });
    }

    try {
      // Verifica se o bot é admin antes de tentar
      const metadata = await sock.groupMetadata(jid);
      const botJid = sock.user.id.split(":")[0] + "@s.whatsapp.net";
      const isAdmin = metadata.participants.some(
        p => p.id === botJid && (p.admin === "admin" || p.admin === "superadmin")
      );

      if (!isAdmin) {
        return sock.sendMessage(jid, {
          text: "⚠️ Preciso de ser admin para banir membros."
        }, { quoted: msg });
      }

      await sock.groupParticipantsUpdate(jid, [targetJid], "remove");

      const number = targetJid.split("@")[0];
      await sock.sendMessage(jid, {
        text: `🚫 Utilizador *${number}* removido do grupo.`
      }, { quoted: msg });

    } catch (err) {
      console.error("[ban] erro:", err.message);
      await sock.sendMessage(jid, {
        text: "⚠️ Não consegui banir. Verifica se sou admin."
      }, { quoted: msg });
    }
  }
};
