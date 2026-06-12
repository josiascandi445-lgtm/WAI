/**
 * Comando: .dado / .sorte
 * Lança um dado ou escolhe aleatoriamente de uma lista.
 * Útil para decisões em grupo.
 */
export default {
  name: "dado",
  aliases: ["sorte", "escolher"],
  description: "Lança um dado ou escolhe uma opção aleatória",

  async execute({ sock, jid, msg, args }) {
    // Modo escolha: .dado opção1 opção2 opção3
    if (args.length >= 2) {
      const opcoes = args.join(" ").split(/[,;|]|\s{2,}/).map(o => o.trim()).filter(Boolean);
      if (opcoes.length >= 2) {
        const escolha = opcoes[Math.floor(Math.random() * opcoes.length)];
        return sock.sendMessage(jid, {
          text: `🎲 *Escolha aleatória:*\n\n📋 Opções: ${opcoes.join(" / ")}\n\n✅ *Escolhido: ${escolha}*`
        }, { quoted: msg });
      }
    }

    // Modo dado: .dado ou .dado 20 (faces personalizadas)
    const faces = Number(args[0]) || 6;
    if (faces < 2 || faces > 1000) {
      return sock.sendMessage(jid, {
        text: "❌ Número de faces deve ser entre 2 e 1000."
      }, { quoted: msg });
    }

    const resultado = Math.floor(Math.random() * faces) + 1;
    const emojis = ["🎲", "🎯", "🃏", "🎮"];
    const e = emojis[Math.floor(Math.random() * emojis.length)];

    await sock.sendMessage(jid, {
      text: `${e} *Dado de ${faces} faces*\n\n🎰 Resultado: *${resultado}*`
    }, { quoted: msg });
  }
};
