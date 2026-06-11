const LANG_EXAMPLES = "pt, en, es, fr, de, it, zh, ar, ru, ja";

export default {
  name: "translate",
  aliases: ["tr"],
  description: "Traduz texto entre idiomas",

  async execute({ sock, jid, msg, args }) {
    if (args.length < 3) {
      return sock.sendMessage(jid, {
        text: `❌ Usa: .translate <de> <para> <texto>\nExemplo: .translate pt en Olá mundo\n\nCódigos: ${LANG_EXAMPLES}`
      }, { quoted: msg });
    }

    const from = args[0].toLowerCase();
    const to   = args[1].toLowerCase();
    const text = args.slice(2).join(" ");

    // Validação básica de código de idioma (2-3 letras)
    if (!/^[a-z]{2,3}$/.test(from) || !/^[a-z]{2,3}$/.test(to)) {
      return sock.sendMessage(jid, {
        text: `❌ Códigos de idioma inválidos.\nUsa códigos de 2 letras, ex: pt, en, fr, es\nExemplos: ${LANG_EXAMPLES}`
      }, { quoted: msg });
    }

    if (text.length > 500) {
      return sock.sendMessage(jid, {
        text: "❌ Texto demasiado longo (máx. 500 caracteres)."
      }, { quoted: msg });
    }

    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
      const res = await fetch(url);

      if (!res.ok) throw new Error(`API retornou ${res.status}`);

      const data = await res.json();

      if (data.responseStatus !== 200) {
        return sock.sendMessage(jid, {
          text: `❌ Tradução falhou: ${data.responseDetails || "idioma não suportado"}\nCódigos válidos: ${LANG_EXAMPLES}`
        }, { quoted: msg });
      }

      const translated = data.responseData?.translatedText;
      if (!translated) throw new Error("Sem tradução");

      await sock.sendMessage(jid, {
        text: `🌐 *${from.toUpperCase()} → ${to.toUpperCase()}*\n\n${translated}`
      }, { quoted: msg });

    } catch (err) {
      console.error("[translate] erro:", err.message);
      await sock.sendMessage(jid, {
        text: "⚠️ Erro ao traduzir. Verifica os códigos de idioma e tenta novamente."
      }, { quoted: msg });
    }
  }
};
