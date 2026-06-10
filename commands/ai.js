export default {
  name: "ai",
  description: "Responde perguntas simples",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .ai <pergunta>"
      }, { quoted: msg });
    }

    const question = args.join(" ");

    try {
      const res = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(question)}&format=json&no_html=1`
      );

      const data = await res.json();

      const answer =
        data.AbstractText ||
        data.Answer ||
        data.Definition ||
        "🤖 Não encontrei uma resposta direta, mas posso ajudar a reformular a pergunta.";

      await sock.sendMessage(jid, {
        text: `🤖 ${answer}`
      }, { quoted: msg });

    } catch (err) {
      await sock.sendMessage(jid, {
        text: "💥 erro na AI"
      }, { quoted: msg });
    }
  }
};
