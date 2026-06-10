export default {
  name: "google",
  description: "Pesquisa inteligente com resposta em texto",

  async execute({ sock, jid, msg, args }) {

    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .google <texto>"
      }, { quoted: msg });
    }

    const query = args.join(" ");

    try {
      const res = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`
      );

      const data = await res.json();

      // 🧠 1. respostas diretas
      let answer =
        data.AbstractText ||
        data.Answer ||
        data.Definition;

      // 🧠 2. fallback inteligente (RelatedTopics)
      if (!answer && data.RelatedTopics?.length) {
        const topic = data.RelatedTopics.find(t => t.Text);

        if (topic?.Text) {
          answer = topic.Text;
        }
      }

      // ❌ nada encontrado mesmo
      if (!answer) {
        return sock.sendMessage(jid, {
          text:
`🔎 ${query}

❌ Não encontrei resposta direta.

👉 Pesquisa manual:
https://duckduckgo.com/?q=${encodeURIComponent(query)}`
        }, { quoted: msg });
      }

      await sock.sendMessage(jid, {
        text:
`🔎 ${query}

🧠 Resposta:
${answer}`
      }, { quoted: msg });

    } catch (err) {
      console.log("google error:", err);

      await sock.sendMessage(jid, {
        text: "💥 erro ao pesquisar"
      }, { quoted: msg });
    }
  }
};
