/**
 * Comando: .ai <pergunta>
 * FIX P13: erro anterior retornava "💥 erro na AI" sem contexto.
 * Agora usa DuckDuckGo Instant Answer com mensagem útil se não houver resposta.
 */
export default {
  name: "ai",
  aliases: ["ask", "bot"],
  description: "Responde perguntas usando DuckDuckGo Instant Answer",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .ai <pergunta>\nExemplo: .ai Qual é a capital de Angola?"
      }, { quoted: msg });
    }

    const q = args.join(" ");

    // Aviso imediato
    await sock.sendMessage(jid, { text: "🤖 A processar..." }, { quoted: msg });

    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&no_redirect=1`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });

      if (!res.ok) throw new Error(`API retornou ${res.status}`);

      const data = await res.json();

      let answer =
        data.AbstractText ||
        data.Answer ||
        data.Definition;

      if (!answer && data.RelatedTopics?.length) {
        const topic = data.RelatedTopics.find(x => x.Text);
        answer = topic?.Text;
      }

      if (!answer) {
        return sock.sendMessage(jid, {
          text: `🤖 Não encontrei resposta directa para:\n*"${q}"*\n\nTenta reformular ou usa .google para pesquisa web.`
        }, { quoted: msg });
      }

      let text = `🤖 *Resposta*\n\n${answer}`;
      if (data.AbstractSource) text += `\n\n📚 Fonte: ${data.AbstractSource}`;

      await sock.sendMessage(jid, { text }, { quoted: msg });

    } catch (err) {
      console.error("[ai] erro:", err.message);
      await sock.sendMessage(jid, {
        text: "⚠️ Não consegui obter resposta. Verifica a ligação e tenta novamente."
      }, { quoted: msg });
    }
  }
};
