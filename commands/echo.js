/**
 * Comando: .echo <texto>
 * Repete o texto enviado.
 */
export default {
  name: "echo",
  aliases: ["say"],
  description: "Repete a mensagem enviada.",

  async execute({ sock, msg, jid, args }) {
    const text = args.join(" ");

    if (!text) {
      await sock.sendMessage(jid, {
        text: "❌ Uso correto: *.echo <texto>*",
      }, { quoted: msg });
      return;
    }

    await sock.sendMessage(jid, { text }, { quoted: msg });
  },
};
