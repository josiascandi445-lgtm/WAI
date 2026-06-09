export default {
  name: "hidetag",
  description: "Mensagem invisível com menção",

  async execute({ sock, jid, msg, args }) {
    if (!msg.key.remoteJid.endsWith("@g.us")) {
      return sock.sendMessage(jid, {
        text: "❌ Só em grupos"
      }, { quoted: msg });
    }

    const text = args.join(" ") || " ";

    const group = await sock.groupMetadata(jid);
    const members = group.participants.map(p => p.id);

    await sock.sendMessage(jid, {
      text,
      mentions: members
    }, { quoted: msg });
  }
};
