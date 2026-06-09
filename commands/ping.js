/**
 * Comando: .ping
 * Responde com "Pong!" e latência aproximada.
 */
export default {
  name: "ping",
  aliases: ["p"],
  description: "Verifica se o bot está online.",

  async execute({ sock, msg, jid }) {
    const start = Date.now();
    const sent = await sock.sendMessage(jid, { text: "🏓 Calculando latência..." }, { quoted: msg });
    const latency = Date.now() - start;

    await sock.sendMessage(jid, {
      text: `🏓 *Pong!*\n📶 Latência: *${latency}ms*`,
    }, { quoted: msg });
  },
};
