/**
 * commands/apk.js
 *
 * NOTA DE DESIGN (importante): este comando NÃO descarrega nem distribui
 * ficheiros .apk. Fazer isso teria dois problemas reais:
 *   1. Apps pagas → distribuir o .apk é pirataria.
 *   2. Qualquer app (paga ou grátis) → um .apk vindo de uma fonte não
 *      oficial (mirror scraped) é um risco de segurança para quem o
 *      instala, e o bot ficaria na posição de "endossar" esse ficheiro.
 *
 * Em vez disso, ".apk <nome>" devolve o link OFICIAL de pesquisa na
 * Google Play Store para esse nome — sempre válido (é apenas uma URL
 * construída, não uma scrape), sem risco de segurança nem legal.
 *
 * Uso:
 *   .apk <nome do app>
 */

export function buildPlayStoreSearchUrl(query) {
  return `https://play.google.com/store/search?q=${encodeURIComponent(query)}&c=apps`;
}

export default {
  name: "apk",
  aliases: ["app"],
  description: "Devolve o link oficial da Play Store para um app (.apk <nome>)",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Uso: .apk <nome do app>\n\nExemplo:\n• .apk whatsapp",
      }, { quoted: msg });
    }

    const query = args.join(" ").trim();
    const url = buildPlayStoreSearchUrl(query);

    await sock.sendMessage(jid, {
      text:
        `🔎 *Resultados para:* "${query}"\n\n` +
        `📲 ${url}\n\n` +
        `_O Toji não distribui ficheiros .apk directamente — apps pagas não podem ser redistribuídas, e um .apk vindo de uma fonte não oficial é um risco de segurança. Este link vai directo à Play Store oficial._`,
    }, { quoted: msg });
  },
};
