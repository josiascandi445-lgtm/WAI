/**
 * Comando: .ai <pergunta>
 *
 * CAUSA DO BUG ANTERIOR: usava a API "DuckDuckGo Instant Answer", que só
 * devolve resultado para tópicos tipo enciclopédia (datas, definições,
 * factos simples) — para perguntas normais devolve sempre vazio. Não é
 * uma ferramenta de IA conversacional, nunca foi a certa para isto.
 *
 * FIX: usa geração de texto real via Pollinations.ai (mesmo provedor
 * gratuito, sem chave, já usado com sucesso pelo .imggen deste projecto).
 */
import { generateText } from "../lib/pollinationsText.js";

export default {
  name: "ai",
  aliases: ["ask", "bot"],
  description: "Responde perguntas usando IA (.ai <pergunta>)",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .ai <pergunta>\nExemplo: .ai Qual é a capital de Angola?"
      }, { quoted: msg });
    }

    const q = args.join(" ");
    await sock.sendMessage(jid, { text: "🤖 A processar..." }, { quoted: msg });

    try {
      const answer = await generateText(q, {
        system: "Responde sempre em português, de forma clara, útil e concisa (máximo 6 frases, a não ser que a pergunta peça explicitamente mais detalhe).",
      });

      await sock.sendMessage(jid, { text: `🤖 *Resposta*\n\n${answer}` }, { quoted: msg });
    } catch (err) {
      console.error("[ai] erro:", err.message);
      await sock.sendMessage(jid, {
        text: "⚠️ Não consegui obter resposta agora. Tenta novamente daqui a pouco."
      }, { quoted: msg });
    }
  }
};
