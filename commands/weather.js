export default {
  name: "weather",
  description: "Mostra clima",

  async execute({ sock, jid, msg, args }) {
    const city = args.join(" ") || "Luanda";

    try {
      const res = await fetch(`https://wttr.in/${city}?format=3`);
      const text = await res.text();

      await sock.sendMessage(jid, {
        text: `🌦 ${text}`
      }, { quoted: msg });

    } catch (err) {
      await sock.sendMessage(jid, {
        text: "💥 erro ao obter clima"
      }, { quoted: msg });
    }
  }
};
