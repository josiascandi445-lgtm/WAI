export default {
  name: "translate",
  description: "Traduz texto",

  async execute({ sock, jid, msg, args }) {
    if (args.length < 2) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .translate pt en texto"
      }, { quoted: msg });
    }

    const [from, to, ...textArr] = args;
    const text = textArr.join(" ");

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
