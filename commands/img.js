/**
 * Comando: .img
 * Pesquisa e envia uma imagem da web.
 * Uso: .img satoru gojo
 *
 * CAUSA DO BUG ANTERIOR: usava "source.unsplash.com", um serviço que a
 * Unsplash DESCONTINUOU (deixou de existir) há já vários anos — por
 * isso falhava sempre, para qualquer pesquisa.
 *
 * FIX: usa a API pública da Wikimedia Commons (infraestrutura oficial
 * da Wikipedia) — pesquisa real, sem chave, sem risco de desaparecer
 * do dia para a noite como um serviço de terceiros.
 */
export default {
  name: "img",
  aliases: ["imagem", "image"],
  description: "Pesquisa e envia uma imagem (.img satoru gojo)",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .img <pesquisa>\nEx: .img satoru gojo"
      }, { quoted: msg });
    }

    const query = args.join(" ");
    await sock.sendMessage(jid, { text: `🔎 A procurar imagem: *${query}*...` }, { quoted: msg });

    try {
      const url =
        `https://commons.wikimedia.org/w/api.php?action=query&generator=search` +
        `&gsrnamespace=6&gsrlimit=5&gsrsearch=${encodeURIComponent(query)}` +
        `&prop=imageinfo&iiprop=url|mime&iiurlwidth=1024&format=json&origin=*`;

      const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
      if (!res.ok) throw new Error(`API devolveu ${res.status}`);

      const data = await res.json();
      const pages = Object.values(data?.query?.pages || {});

      // Filtra só imagens de facto (a pesquisa pode devolver PDFs, SVGs de diagramas, etc.)
      const candidate = pages.find(p => {
        const info = p.imageinfo?.[0];
        return info && /^image\/(jpeg|png|webp|gif)$/.test(info.mime || "");
      });

      if (!candidate) throw new Error("Sem imagens nos resultados");

      const info = candidate.imageinfo[0];
      const imageUrl = info.thumburl || info.url;

      await sock.sendMessage(jid, {
        image: { url: imageUrl },
        caption: `🖼️ *${query}*`
      }, { quoted: msg });

    } catch (err) {
      console.error("[img] erro:", err.message);
      await sock.sendMessage(jid, {
        text: `❌ Não consegui encontrar uma imagem para *${query}*. Tenta outra pesquisa.`
      }, { quoted: msg });
    }
  }
};
