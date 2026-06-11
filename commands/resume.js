/**
 * Comando: .resume <texto>
 * Resume texto usando extração local de frases-chave.
 * CORREÇÃO: A API meaningcloud.com requer API key paga — substituída
 *           por resumo local baseado em frequência de palavras (TF).
 *           Funciona sem dependências externas e sem chaves.
 */
export default {
  name: "resume",
  description: "Resume um texto em 2-3 frases",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .resume <texto longo>"
      }, { quoted: msg });
    }

    const text = args.join(" ");

    if (text.length < 80) {
      return sock.sendMessage(jid, {
        text: "⚠️ Texto demasiado curto para resumir. Envia pelo menos 80 caracteres."
      }, { quoted: msg });
    }

    try {
      const summary = extractiveSummary(text, 2);

      await sock.sendMessage(jid, {
        text: `🧾 *Resumo:*\n\n${summary}`
      }, { quoted: msg });

    } catch (err) {
      console.error("[resume] erro:", err.message);
      await sock.sendMessage(jid, {
        text: "💥 Não consegui resumir o texto."
      }, { quoted: msg });
    }
  }
};

/**
 * Resumo extrativo simples por frequência de palavras (TF).
 * Seleciona as N frases com maior pontuação.
 * @param {string} text
 * @param {number} numSentences
 * @returns {string}
 */
function extractiveSummary(text, numSentences = 2) {
  // Divide em frases
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 20);

  if (sentences.length <= numSentences) return text;

  // Palavras de paragem (stopwords) PT + EN básicas
  const stopwords = new Set([
    "o","a","os","as","um","uma","uns","umas","de","do","da","dos","das",
    "em","no","na","nos","nas","por","para","com","sem","sob","sobre",
    "e","ou","mas","que","se","não","é","são","foi","ser","ter","há",
    "the","a","an","is","are","was","were","be","to","of","and","in",
    "it","its","this","that","they","he","she","we","you","i","at","on"
  ]);

  // Frequência de palavras relevantes
  const freq = {};
  const words = text.toLowerCase().match(/\b[a-záéíóúàâêôãõüç]{3,}\b/g) ?? [];
  for (const w of words) {
    if (!stopwords.has(w)) freq[w] = (freq[w] ?? 0) + 1;
  }

  // Pontua cada frase pela soma das frequências das suas palavras
  const scored = sentences.map(sentence => {
    const sWords = sentence.toLowerCase().match(/\b[a-záéíóúàâêôãõüç]{3,}\b/g) ?? [];
    const score = sWords.reduce((sum, w) => sum + (freq[w] ?? 0), 0);
    return { sentence, score };
  });

  // Ordena por pontuação, mantém as top N, e recoloca na ordem original
  const topScores = scored
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, numSentences)
    .map(x => x.sentence);

  const result = scored
    .filter(x => topScores.includes(x.sentence))
    .map(x => x.sentence);

  return result.join(" ");
}
