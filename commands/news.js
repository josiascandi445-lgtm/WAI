/**
 * Comando: .news [categoria]
 * FIX: feeds 100% em português (Angola, Portugal, Brasil).
 * Categorias: angola, portugal, brasil, desporto, tech
 */
const FEEDS = {
  angola:   "https://www.voanoticias.com/api/zyovmiezk_",
  portugal: "https://www.publico.pt/rss",
  brasil:   "https://g1.globo.com/rss/g1/",
  desporto: "https://www.record.pt/rss",
  tech:     "https://pplware.sapo.pt/feed/",
};

// Feeds de fallback simples (RSS públicos que funcionam)
const FEEDS_FALLBACK = {
  angola:   "https://feeds.feedburner.com/JornalDeAngola",
  portugal: "https://observador.pt/feed/",
  brasil:   "https://rss.uol.com.br/feed/noticias.xml",
  desporto: "https://www.ojogo.pt/rss",
  tech:     "https://www.tecmundo.com.br/rss",
};

async function parseRSS(xml) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 6);
  return items.map(([, inner]) => {
    const title = inner.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s)?.[1]?.trim().replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">") ?? "";
    const link  = inner.match(/<link>(.*?)<\/link>/)?.[1]?.trim() ?? 
                  inner.match(/<link[^>]*href="([^"]+)"/)?.[1]?.trim() ?? "";
    return { title, link };
  }).filter(i => i.title);
}

export default {
  name: "news",
  aliases: ["noticias", "novidades"],
  description: "Notícias em português (angola, portugal, brasil, desporto, tech)",

  async execute({ sock, jid, msg, args }) {
    const cat = (args[0] || "angola").toLowerCase();

    if (!FEEDS[cat]) {
      return sock.sendMessage(jid, {
        text: `❌ Categoria inválida.\n\n📋 Disponíveis:\n• angola\n• portugal\n• brasil\n• desporto\n• tech\n\nEx: .news angola`
      }, { quoted: msg });
    }

    await sock.sendMessage(jid, { text: `📰 A carregar notícias (${cat})...` }, { quoted: msg });

    const tryFeed = async (url) => {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; RSS Reader)" }
      });
      if (!res.ok) throw new Error(`Feed retornou ${res.status}`);
      return res.text();
    };

    try {
      let xml;
      try {
        xml = await tryFeed(FEEDS[cat]);
      } catch {
        xml = await tryFeed(FEEDS_FALLBACK[cat]);
      }

      const items = await parseRSS(xml);
      if (!items.length) throw new Error("Sem artigos");

      const emoji = { angola: "🇦🇴", portugal: "🇵🇹", brasil: "🇧🇷", desporto: "⚽", tech: "💻" }[cat] || "📰";

      const lines = items.map((it, i) =>
        `${i + 1}. *${it.title}*${it.link ? `\n   🔗 ${it.link}` : ""}`
      ).join("\n\n");

      await sock.sendMessage(jid, {
        text: `${emoji} *Notícias — ${cat.toUpperCase()}*\n\n${lines}`
      }, { quoted: msg });

    } catch (err) {
      console.error("[news] erro:", err.message);
      await sock.sendMessage(jid, {
        text: `⚠️ Não consegui carregar as notícias de *${cat}* agora.\nTenta novamente mais tarde.`
      }, { quoted: msg });
    }
  }
};
