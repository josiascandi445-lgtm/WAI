/**
 * Comando: .ping
 * FIX: removido alias "p" que conflitava com play.js
 */
export default {
  name: "ping",
  aliases: ["latency"],
  description: "Verifica se o bot está online e mede latência.",

  async execute({ sock, msg, jid }) {
    const start = Date.now();
    await sock.sendMessage(jid, { text: "🏓 Pong!" }, { quoted: msg });
    const latency = Date.now() - start;

    await sock.sendMessage(jid, {
      text: `🏓 *Pong!*\n📶 Latência: *${latency}ms*\n⚡ Estado: Online`,
    }, { quoted: msg });
  },
};
