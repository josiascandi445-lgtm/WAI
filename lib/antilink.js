import {
  enableAntiLink,
  disableAntiLink,
  isAntiLinkEnabled
} from "../lib/antilink.js";

export default {
  name: "antilink",
  description: "Ativa ou desativa anti-link",

  async execute({ sock, jid, msg, args, isGroup }) {
    if (!isGroup) {
      return sock.sendMessage(
        jid,
        { text: "❌ Apenas para grupos." },
        { quoted: msg }
      );
    }

    const option = args[0]?.toLowerCase();

    if (!option) {
      return sock.sendMessage(
        jid,
        {
          text:
            `🛡️ Anti-Link: ${
              isAntiLinkEnabled(jid) ? "ATIVADO" : "DESATIVADO"
            }\n\nUso:\n.antilink on\n.antilink off`
        },
        { quoted: msg }
      );
    }

    if (option === "on") {
      enableAntiLink(jid);

      return sock.sendMessage(
        jid,
        { text: "✅ Anti-Link ativado." },
        { quoted: msg }
      );
    }

    if (option === "off") {
      disableAntiLink(jid);

      return sock.sendMessage(
        jid,
        { text: "❌ Anti-Link desativado." },
        { quoted: msg }
      );
    }

    return sock.sendMessage(
      jid,
      { text: "❌ Usa .antilink on ou .antilink off" },
      { quoted: msg }
    );
  }
};
