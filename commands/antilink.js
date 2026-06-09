const antiLinkStatus = new Map();

export default {
  name: "antilink",
  description: "Bloqueia links no grupo",

  async execute({ sock, jid, msg, args }) {
    if (!jid.endsWith("@g.us")) {
      return sock.sendMessage(jid, {
        text: "❌ Só em grupos"
      }, { quoted: msg });
    }

    const mode = args[0];

    if (mode === "on") {
      antiLinkStatus.set(jid, true);
      return sock.sendMessage(jid, { text: "🔒 Anti-link ativado" }, { quoted: msg });
    }

    if (mode === "off") {
      antiLinkStatus.set(jid, false);
      return sock.sendMessage(jid, { text: "🔓 Anti-link desativado" }, { quoted: msg });
    }

    await sock.sendMessage(jid, {
      text: "❌ Usa: .antilink on/off"
    }, { quoted: msg });
  }
};

export { antiLinkStatus };
