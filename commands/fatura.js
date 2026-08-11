/**
 * commands/fatura.js
 *
 * .fatura produto, nome do cliente, data e hora
 *
 * Exemplo:
 *   .fatura 200 diamantes, João André, 10/08/2026 15:30
 *
 * Toda a lógica (parsing, número único, geração da imagem) vive em
 * lib/fatura.js — este ficheiro só valida o uso e envia a imagem.
 */
import { parseFaturaInput, generateFaturaNumber, renderFaturaImage } from "../lib/fatura.js";

const USAGE_TEXT =
  "❌ Formato incorreto.\n\n" +
  "Use:\n" +
  ".fatura produto, nome do cliente, data e hora\n\n" +
  "Exemplo:\n" +
  ".fatura 200 diamantes, João André, 10/08/2026 15:30\n\n" +
  "_Formatos de data aceites: 10/08/2026 15:30 ou 10-08-2026 15:30_";

export default {
  name: "fatura",
  description: "Gera uma fatura/recibo em imagem (.fatura produto, cliente, data hora)",

  async execute({ sock, jid, msg, args }) {
    const rawText = args.join(" ").trim();

    if (!rawText) {
      return sock.sendMessage(jid, { text: USAGE_TEXT }, { quoted: msg });
    }

    const parsed = parseFaturaInput(rawText);
    if (!parsed.ok) {
      return sock.sendMessage(jid, { text: USAGE_TEXT }, { quoted: msg });
    }

    try {
      const numero = generateFaturaNumber();
      const image = await renderFaturaImage({
        numero,
        cliente: parsed.cliente,
        produto: parsed.produto,
        data: parsed.data,
        hora: parsed.hora,
      });

      await sock.sendMessage(jid, {
        image,
        caption: `🧾 Fatura ${numero} gerada.`,
      }, { quoted: msg });

      console.log(`[fatura] ✅ ${numero} — ${parsed.cliente} — ${parsed.produto}`);
    } catch (err) {
      console.error("[fatura] erro:", err.message);
      await sock.sendMessage(jid, { text: "⚠️ Erro ao gerar a fatura. Tenta novamente." }, { quoted: msg });
    }
  },
};
