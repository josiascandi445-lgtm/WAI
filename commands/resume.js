export default {
  name: "resume",
  description: "Resume texto",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .resume texto"
      }, { quoted: msg });
    }

    const text = args.join(" ");

    try {
      const res = await fetch(
        `https://api.meaningcloud.com/summarization-1.0?txt=${encodeURIComponent(text)}&sentences=2`
      );

      const data = await res.json();

      const summary =
        data?.summary ||
        "⚠️ não foi possível resumir automaticamente";

      await sock.sendMessage(jid, {
        text: `🧾 ${summary}`
      }, { quoted: msg });

    } catch (err) {
      await sock.sendMessage(jid, {
        text: "💥 erro ao resumir"
      }, { quoted: msg });
    }
  }
};
