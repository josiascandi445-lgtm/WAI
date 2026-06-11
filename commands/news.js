/**
 * Comando: .news [categoria]
 * Mostra headlines de notícias via RSS público.
 * Categorias: tech, world, angola (padrão: world)
 */
const FEEDS = {
  tech:   "https://feeds.bbci.co.uk/news/technology/rss.xml",
  world:  "https://feeds.bbci.co.uk/news/world/rss.xml",
  angola: "https://feeds.feedburner.com/JornalDeAngola",
  pt:     "https://feeds.feedburner.com/PublicoRSS",
};

async function parseRSS(xml) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 5);
  return items.map(([, inner]) => {
    const title = inner.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? "";
    const link  = inner.match(/<link>(.*?)<\/link>/)?.[1]?.trim() ?? "";
    return { title, link };
  });
}

export default {
  name: "news",
  aliases: ["noticias"],
  description: "Mostra notícias recentes (world, tech, angola, pt)",

  async execute({ sock, jid, msg, args }) {
    const cat = (args[0] || "world").toLowerCase();
    const feedUrl = FEEDS[cat];

    if (!feedUrl) {
      return sock.sendMessage(jid, {
        text: `❌ Categoria inválida.\nDisponíveis: ${Object.keys(FEEDS).join(", ")}\nExemplo: .news tech`
      }, { quoted: msg });
    }

    try {
      await sock.sendMessage(jid, { text: `📰 A carregar notícias (${cat})...` }, { quoted: msg });

      const res = await fetch(feedUrl, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`Feed retornou ${res.status}`);

      const xml   = await res.text();
      const items = await parseRSS(xml);

      if (!items.length) throw new Error("Sem artigos");

      const lines = items.map((it, i) => `${i + 1}. ${it.title}\n   🔗 ${it.link}`).join("\n\n");

      await sock.sendMessage(jid, {
        text: `📰 *Notícias — ${cat.toUpperCase()}*\n\n${lines}`
      }, { quoted: msg });

    } catch (err) {
      console.error("[news] erro:", err.message);
      await sock.sendMessage(jid, {
        text: "⚠️ Não foi possível carregar notícias agora. Tenta mais tarde."
      }, { quoted: msg });
    }
  }
};
