export default {
  name: "google",
  description: "Pesquisa no Google",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .google <texto>"
      }, { quoted: msg });
    }

    const query = args.join(" ");
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    await sock.sendMessage(jid, {
      text: `🔎 Resultado:\n${url}`
    }, { quoted: msg });
  }
};
