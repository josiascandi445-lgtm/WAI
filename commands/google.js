/**
 * Comando: .google
 *
 * CAUSA DO BUG ANTERIOR: mesmo problema do .ai — a API "DuckDuckGo
 * Instant Answer" não é um motor de pesquisa geral, só devolve algo
 * para tópicos tipo enciclopédia. Para a maioria das pesquisas normais
 * devolvia sempre "sem resultados".
 *
 * FIX: pesquisa resultados REAIS a partir da página HTML pública do
 * DuckDuckGo (html.duckduckgo.com/html/) — mesma categoria de solução
 * "melhor esforço, sem chave" já usada no .pin deste projecto. Sem API
 * key disponível para pesquisa web geral gratuita, esta é a alternativa
 * mais robusta sem depender de nenhum serviço pago.
 */
function escapeXml(s) {
  return String(s).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
}

/** Extrai título+link+snippet dos resultados da página HTML do DDG. Função pura. */
export function parseDuckDuckGoHtml(html, limit = 5) {
  const results = [];
  const blockRe = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = blockRe.exec(html)) && results.length < limit) {
    const rawUrl = m[1];
    const title = escapeXml(m[2].replace(/<[^>]+>/g, "").trim());
    const snippet = escapeXml(m[3].replace(/<[^>]+>/g, "").trim());

    // DDG usa um redirect próprio (//duckduckgo.com/l/?uddg=URL_REAL) — extrai o URL real.
    let url = rawUrl;
    const uddgMatch = rawUrl.match(/[?&]uddg=([^&]+)/);
    if (uddgMatch) url = decodeURIComponent(uddgMatch[1]);
    else if (url.startsWith("//")) url = "https:" + url;

    if (title && url) results.push({ title, url, snippet });
  }
  return results;
}

export default {
  name: "google",
  aliases: ["pesquisar", "search"],
  description: "Pesquisa na web (.google <pesquisa>)",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .google <pesquisa>\nEx: .google Capital de Angola"
      }, { quoted: msg });
    }

    const query = args.join(" ");
    await sock.sendMessage(jid, { text: `🔎 A pesquisar: *${query}*...` }, { quoted: msg });

    try {
      const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=pt-pt`, {
        signal: AbortSignal.timeout(12_000),
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const html = await res.text();
      const results = parseDuckDuckGoHtml(html, 5);

      if (!results.length) {
        return sock.sendMessage(jid, {
          text: `🔎 *${query}*\n\n❌ Sem resultados directos.\n\n👉 Pesquisa completa:\nhttps://www.google.com/search?q=${encodeURIComponent(query)}&hl=pt`
        }, { quoted: msg });
      }

      const lines = results.map((r, i) => `${i + 1}. *${r.title}*\n${r.snippet}\n🔗 ${r.url}`).join("\n\n");
      const text = `🔎 *${query}*\n\n${lines}\n\n🌐 Mais resultados:\nhttps://www.google.com/search?q=${encodeURIComponent(query)}&hl=pt`;

      await sock.sendMessage(jid, { text }, { quoted: msg });
    } catch (err) {
      console.error("[google] erro:", err.message);
      await sock.sendMessage(jid, {
        text: `🔎 *${query}*\n\n⚠️ Erro ao pesquisar. Usa o link:\n🌐 https://www.google.com/search?q=${encodeURIComponent(query)}&hl=pt`
      }, { quoted: msg });
    }
  }
};
