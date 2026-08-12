/**
 * Comando: .quote
 * Envia uma citação motivacional aleatória.
 *
 * CAUSA DO BUG ANTERIOR: usava a API zenquotes.io, que só tem citações
 * em inglês (sem opção de idioma).
 *
 * FIX: gera a citação em português via Pollinations.ai (mesmo provedor
 * já usado em .ai/.imggen). Mantém uma lista de reserva em português
 * (ampliada) para quando a geração falhar.
 */
import { generateText } from "../lib/pollinationsText.js";

const FALLBACK = [
  { content: "O sucesso é a soma de pequenos esforços repetidos dia após dia.", author: "Robert Collier" },
  { content: "Não é o mais forte que sobrevive, mas o mais adaptável.", author: "Charles Darwin" },
  { content: "A persistência é o caminho do êxito.", author: "Charlie Chaplin" },
  { content: "O único lugar onde o sucesso vem antes do trabalho é no dicionário.", author: "Vidal Sassoon" },
  { content: "Grandes conquistas exigem grandes ambições.", author: "Heráclito" },
  { content: "A disciplina é a ponte entre metas e realizações.", author: "Jim Rohn" },
  { content: "Não contes os dias, faz com que os dias contem.", author: "Muhammad Ali" },
  { content: "Quem sabe fazer, faz. Quem sabe mesmo, ensina.", author: "Aristóteles" },
  { content: "A dúvida é o princípio da sabedoria.", author: "Aristóteles" },
  { content: "Cai sete vezes, levanta-te oito.", author: "Provérbio japonês" },
];

function parseQuote(raw) {
  // Espera algo como: "texto da citação" — Autor
  const match = raw.match(/["“]?([^"”]+)["”]?\s*[-—]\s*(.+)$/);
  if (match) return { content: match[1].trim(), author: match[2].trim() };
  return null;
}

export default {
  name: "quote",
  aliases: ["citacao", "frase"],
  description: "Envia uma citação motivacional em português",

  async execute({ sock, jid, msg }) {
    try {
      const raw = await generateText(
        "Dá-me UMA citação motivacional curta e real (com autor conhecido), em português. Formato exacto: \"texto da citação\" — Autor. Não expliques nada, só a citação nesse formato.",
        { timeoutMs: 15_000 }
      );

      const parsed = parseQuote(raw);
      if (!parsed) throw new Error("Formato inesperado da resposta");

      await sock.sendMessage(jid, {
        text: `💬 _"${parsed.content}"_\n\n— *${parsed.author}*`
      }, { quoted: msg });

    } catch (err) {
      console.warn("[quote] geração falhou, a usar reserva:", err.message);
      const q = FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
      await sock.sendMessage(jid, {
        text: `💬 _"${q.content}"_\n\n— *${q.author}*`
      }, { quoted: msg });
    }
  }
};
