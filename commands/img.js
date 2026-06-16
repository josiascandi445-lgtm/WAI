/**
 * Comando: .img
 * Pesquisa e envia uma imagem da web.
 * Uso: .img satoru gojo
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
      // Source.unsplash.com redirecciona para uma imagem relevante à pesquisa,
      // sem necessitar de API key — fiável para uso básico de pesquisa de imagem.
      const res = await fetch(
        `https://source.unsplash.com/featured/800x600/?${encodeURIComponent(query)}`,
        { signal: AbortSignal.timeout(12_000), redirect: "follow" }
      );

      if (!res.ok) throw new Error(`Resposta ${res.status}`);

      const imageUrl = res.url;

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
