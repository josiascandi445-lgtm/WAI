export default {
  name: "translate",

  async execute({ sock, jid, msg, args }) {
    if (args.length < 3) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .translate en pt hello world"
      }, { quoted: msg });
    }

    const from = args[0];
    const to = args[1];
    const text = args.slice(2).join(" ");

    try {
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`
      );

      const data = await res.json();

      await sock.sendMessage(jid, {
        text: `🌐 ${data.responseData.translatedText}`
      }, { quoted: msg });

    } catch (err) {
      await sock.sendMessage(jid, {
        text: "💥 erro na tradução"
      }, { quoted: msg });
    }
  }
};
