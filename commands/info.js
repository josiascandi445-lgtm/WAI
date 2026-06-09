/**
 * Comando: .info
 * Mostra informações sobre o utilizador e o chat atual.
 */
export default {
  name: "info",
  description: "Mostra informações sobre ti e o chat atual.",

  async execute({ sock, msg, jid, sender, isGroup, botName }) {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const text =
      `ℹ️ *Informações*\n\n` +
      `👤 *O teu JID:* ${sender}\n` +
      `💬 *Chat:* ${isGroup ? "Grupo" : "Privado"}\n` +
      `🆔 *JID do chat:* ${jid}\n\n` +
      `🤖 *Bot:* ${botName}\n` +
      `⏱️ *Uptime:* ${hours}h ${minutes}m ${seconds}s\n` +
      `🖥️ *Node.js:* ${process.version}`;

    await sock.sendMessage(jid, { text }, { quoted: msg });
  },
};
