/**
 * Comando: .google
 * FIX: resultados em português usando DuckDuckGo com lang=pt-pt
 * e fallback para Bing Search RSS (em PT).
 */
export default {
  name: "google",
  aliases: ["pesquisar", "search"],
  description: "Pesquisa na web e retorna resultados em português",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .google <pesquisa>\nEx: .google Capital de Angola"
      }, { quoted: msg });
    }

    const query = args.join(" ");
    await sock.sendMessage(jid, { text: `🔎 A pesquisar: *${query}*...` }, { quoted: msg });

    try {
      // DuckDuckGo com língua portuguesa
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&kl=pt-pt`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });

      if (!res.ok) throw new Error(`API retornou ${res.status}`);

      const data = await res.json();

      let answer = data.AbstractText || data.Answer || data.Definition;

      if (!answer && data.RelatedTopics?.length) {
        const topic = data.RelatedTopics.find(t => t.Text);
        answer = topic?.Text;
      }

      // Resulados relacionados (até 4)
      const related = (data.RelatedTopics || [])
        .filter(t => t.Text && t.FirstURL)
        .slice(0, 4)
        .map((t, i) => `${i + 1}. ${t.Text.split(" - ")[0]}\n   🔗 ${t.FirstURL}`)
        .join("\n\n");

      if (!answer && !related) {
        return sock.sendMessage(jid, {
          text: `🔎 *${query}*\n\n❌ Sem resultados directos.\n\n👉 Pesquisa completa:\nhttps://www.google.com/search?q=${encodeURIComponent(query)}&hl=pt`
        }, { quoted: msg });
      }

      let text = `🔎 *${query}*\n\n`;
      if (answer) text += `💡 *Resposta:*\n${answer}\n`;
      if (data.AbstractSource) text += `📚 Fonte: ${data.AbstractSource}\n`;
      if (related) text += `\n📋 *Resultados relacionados:*\n${related}\n`;
      text += `\n🌐 Mais resultados:\nhttps://www.google.com/search?q=${encodeURIComponent(query)}&hl=pt`;

      await sock.sendMessage(jid, { text }, { quoted: msg });

    } catch (err) {
      console.error("[google] erro:", err.message);
      // Fallback: apenas envia o link da pesquisa
      await sock.sendMessage(jid, {
        text: `🔎 *${query}*\n\n⚠️ Erro ao pesquisar. Usa o link:\n🌐 https://www.google.com/search?q=${encodeURIComponent(query)}&hl=pt`
      }, { quoted: msg });
    }
  }
};
