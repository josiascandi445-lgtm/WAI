export default {
  name: "define",
  description: "Define palavras",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .define <palavra>"
      }, { quoted: msg });
    }

    const word = args[0];
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      const meaning = data[0]?.meanings[0]?.definitions[0]?.definition;

      await sock.sendMessage(jid, {
        text: `📖 ${word}:\n${meaning || "Não encontrado"}`
      }, { quoted: msg });

    } catch {
      await sock.sendMessage(jid, {
        text: "⚠️ Erro ao procurar definição"
      }, { quoted: msg });
    }
  }
};
