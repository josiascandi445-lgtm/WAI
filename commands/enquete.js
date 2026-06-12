/**
 * Comando: .enquete / .poll
 * Cria uma enquete nativa do WhatsApp (tipo votação).
 * Uso: .enquete Pergunta? | Opção1 | Opção2 | Opção3
 */
export default {
  name: "enquete",
  aliases: ["poll", "votacao"],
  description: "Cria uma enquete/votação no grupo (.enquete Pergunta? | Op1 | Op2)",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .enquete Pergunta? | Opção1 | Opção2 | Opção3\n\nEx: .enquete Qual o melhor dia? | Segunda | Sexta | Sábado"
      }, { quoted: msg });
    }

    const full   = args.join(" ");
    const partes = full.split("|").map(p => p.trim()).filter(Boolean);

    if (partes.length < 3) {
      return sock.sendMessage(jid, {
        text: "❌ Precisa de pelo menos 1 pergunta e 2 opções.\nSepara com *|*\n\nEx: .enquete Gostas? | Sim | Não"
      }, { quoted: msg });
    }

    const pergunta = partes[0];
    const opcoes   = partes.slice(1, 13); // WhatsApp aceita até 12 opções

    try {
      await sock.sendMessage(jid, {
        poll: {
          name: pergunta,
          values: opcoes,
          selectableCount: 1,
        }
      }, { quoted: msg });
    } catch (err) {
      console.error("[enquete] erro:", err.message);
      // Fallback: envia como texto normal
      const opcoesTexto = opcoes.map((o, i) => `${i + 1}. ${o}`).join("\n");
      await sock.sendMessage(jid, {
        text: `📊 *${pergunta}*\n\n${opcoesTexto}\n\n_Responde com o número da tua escolha._`
      }, { quoted: msg });
    }
  }
};
