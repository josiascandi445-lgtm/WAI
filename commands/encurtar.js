/**
 * Comando: .encurtar
 * Encurta um URL longo.
 * Uso: .encurtar https://exemplo.com/caminho/muito/longo
 */
export default {
  name: "encurtar",
  aliases: ["shorturl", "encurta"],
  description: "Encurta um URL longo",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .encurtar <URL>\nEx: .encurtar https://exemplo.com/pagina/longa"
      }, { quoted: msg });
    }

    let url = args[0];
    if (!url.startsWith("http")) url = `https://${url}`;

    try {
      const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(10_000)
      });

      if (!res.ok) throw new Error(`Resposta ${res.status}`);

      const encurtado = await res.text();

      if (!encurtado.startsWith("http")) throw new Error("Resposta inválida");

      await sock.sendMessage(jid, {
        text: `🔗 *URL encurtado*\n\n📎 Original: ${url}\n✅ Encurtado: ${encurtado}`
      }, { quoted: msg });

    } catch (err) {
      console.error("[encurtar] erro:", err.message);
      await sock.sendMessage(jid, { text: "⚠️ Não consegui encurtar este URL. Verifica se é válido." }, { quoted: msg });
    }
  }
};
