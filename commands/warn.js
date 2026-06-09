const warns = new Map();

export default {
  name: "warn",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .warn @user"
      }, { quoted: msg });
    }

    const user = args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net";

    const current = warns.get(user) || 0;
    const newCount = current + 1;

    warns.set(user, newCount);

    await sock.sendMessage(jid, {
      text: `⚠️ Aviso para usuário\nTotal: ${newCount}/3`
    }, { quoted: msg });

    if (newCount >= 3) {
      await sock.groupParticipantsUpdate(jid, [user], "remove");

      await sock.sendMessage(jid, {
        text: "🚫 Usuário expulso por 3 warns"
      });
    }
  }
};

export { warns };
