export default {
  name: "ai",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .ai <pergunta>"
      }, { quoted: msg });
    }

    const q = args.join(" ");

    try {
      const res = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&no_redirect=1`
      );

      const data = await res.json();

      let answer =
        data.AbstractText ||
        data.Answer ||
        data.Definition;

      if (!answer && data.RelatedTopics?.length) {
        const t = data.RelatedTopics.find(x => x.Text);
        answer = t?.Text;
      }

      if (!answer) {
        answer = "Não tenho uma resposta direta para isso, mas posso ajudar se reformulares a pergunta.";
      }

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
