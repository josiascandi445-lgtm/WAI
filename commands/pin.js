/**
 * commands/pin.js
 *
 * O Pinterest não tem API pública de pesquisa sem autenticação/parceria.
 * A página de pesquisa (pinterest.com/search/pins) é acessível sem login
 * e devolve HTML com os URLs das imagens embutidos — extraímos esses URLs
 * directamente (mesma categoria de solução "best-effort" já usada neste
 * projecto para a pesquisa do TikTok via tikwm). É o método mais robusto
 * disponível sem chave de API, mas — tal como avisado sobre a tikwm —
 * pode quebrar se o Pinterest alterar a estrutura da página. Se isso
 * acontecer, o comando falha com uma mensagem clara em vez de travar o bot.
 *
 * Uso:
 *   .pin <termo>
 *   .pinterest <termo>
 */
const SEARCH_URL = (q) => `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}&rs=typed`;

// URLs de imagens do CDN do Pinterest costumam ter uma pasta de tamanho
// (ex: /736x/, /564x/, /originals/). Excluímos as miniaturas muito
// pequenas (ex: /75x75/, /30x30/ usadas em avatares/ícones da UI).
const IMG_RE = /https:\/\/i\.pinimg\.com\/(?!(?:30x30|60x60|75x75|140x140)\/)[^\s"'\\]+\.(?:jpg|jpeg|png)/gi;

/**
 * Extrai URLs de imagens únicas do HTML da página de pesquisa.
 * Função pura — testável sem fazer pedidos de rede.
 * @param {string} html
 * @param {number} limit
 * @returns {string[]}
 */
export function extractPinImageUrls(html, limit = 3) {
  const found = html.match(IMG_RE) || [];
  const unique = [...new Set(found)];
  return unique.slice(0, limit);
}

export default {
  name: "pin",
  aliases: ["pinterest"],
  description: "Pesquisa imagens no Pinterest (.pin <termo>)",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Uso: .pin <termo>\n\nExemplo:\n• .pin decoração de quarto minimalista",
      }, { quoted: msg });
    }

    const query = args.join(" ").trim();
    let statusMsg;
    try {
      statusMsg = await sock.sendMessage(jid, { text: "🔎 *A procurar no Pinterest...*" }, { quoted: msg });
    } catch {}

    try {
      console.log(`[pin] a pesquisar: "${query}"`);
      const res = await fetch(SEARCH_URL(query), {
        signal: AbortSignal.timeout(20_000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; TojiBot/1.0)" },
      });

      if (!res.ok) throw new Error(`Pinterest devolveu HTTP ${res.status}`);

      const html = await res.text();
      const urls = extractPinImageUrls(html, 3);

      if (!urls.length) {
        throw new Error("Nenhuma imagem encontrada — tenta um termo diferente ou tenta novamente mais tarde");
      }

      console.log(`[pin] ✅ ${urls.length} imagem(ns) encontrada(s)`);

      for (const url of urls) {
        try {
          await sock.sendMessage(jid, { image: { url } }, { quoted: msg });
        } catch (sendErr) {
          console.warn(`[pin] falha ao enviar uma imagem: ${sendErr.message}`);
        }
      }

      if (statusMsg) try { await sock.sendMessage(jid, { delete: statusMsg.key }); } catch {}
    } catch (err) {
      console.error(`[pin] ❌ erro: ${err.message}`);
      const text = `❌ Não consegui pesquisar no Pinterest agora.\n\n${err.message}`;
      if (statusMsg) {
        try { return await sock.sendMessage(jid, { text, edit: statusMsg.key }); } catch {}
      }
      await sock.sendMessage(jid, { text }, { quoted: msg });
    }
  },
};
