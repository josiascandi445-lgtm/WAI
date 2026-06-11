/**
 * Comando: .uptime
 * FIX: usa process.uptime() (tempo real do processo Node) em vez de Date.now()
 * no módulo, que reiniciava ao reimportar.
 */
export default {
  name: "uptime",
  aliases: ["ut"],
  description: "Mostra o tempo de actividade do bot",

  async execute({ sock, jid, msg, botName }) {
    const elapsed = Math.floor(process.uptime());
    const d = Math.floor(elapsed / 86400);
    const h = Math.floor((elapsed % 86400) / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;

    const parts = [];
    if (d) parts.push(`${d}d`);
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    parts.push(`${s}s`);

    const mem = process.memoryUsage();
    const memMB = (mem.rss / 1024 / 1024).toFixed(1);

    await sock.sendMessage(jid, {
      text: `⏱️ *${botName || "Bot"}*\n\n🕐 Online há: *${parts.join(" ")}*\n💾 Memória usada: *${memMB} MB*`
    }, { quoted: msg });
  }
};
