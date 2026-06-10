export default {
  name: "google",
  description: "Pesquisa e devolve resposta resumida",

  async execute({ sock, jid, msg, args }) {

    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .google <texto>"
      }, { quoted: msg });
    }

    const query = args.join(" ");

    try {
      // DuckDuckGo Instant Answer API (sem bloqueios chatos)
      const res = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`
      );

      const data = await res.json();

      let answer =
        data.AbstractText ||
        data.Answer ||
        data.Definition ||
        null;

      // fallback se não houver resposta direta
      if (!answer) {
        return sock.sendMessage(jid, {
          text:
`🔎 Resultado para: ${query}

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
        text: "💥 Erro ao pesquisar."
      }, { quoted: msg });
    }
  }
};
