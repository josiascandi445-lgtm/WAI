export default {
  name: "add",
  aliases: ["invite"],
  description: "Adiciona membro ao grupo",

  async execute({ sock, jid, msg, isGroup, args }) {
    if (!isGroup) {
      return sock.sendMessage(jid, {
        text: "❌ Este comando só funciona em grupos"
      }, { quoted: msg });
    }

    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .add 2449xxxxxxx"
      }, { quoted: msg });
    }

    try {
      const number = args[0].replace(/[^0-9]/g, "");

      if (!number) {
        return sock.sendMessage(jid, {
          text: "❌ Número inválido"
        }, { quoted: msg });
      }

      const userJid = number + "@s.whatsapp.net";

      await sock.groupParticipantsUpdate(jid, [userJid], "add");

      await sock.sendMessage(jid, {
        text: `➕ Usuário adicionado ao grupo`
      });

    } catch (err) {
      console.error("[add] erro:", err);

      await sock.sendMessage(jid, {
        text: "⚠️ Não consegui adicionar (preciso ser admin)"
      }, { quoted: msg });
    }
  }
};
