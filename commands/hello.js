export default {
  name: "hello",
  aliases: ["ola", "hi", "salve"],
  description: "Mensagem de saudação do bot",

  async execute({ sock, msg, jid, sender, botName }) {
    const user = sender.split("@")[0];

    const text =
`👋 Olá!

Eu sou o *${botName}*.
Estou online e a funcionar insolente.
Qualquer dúvida pergunta para mim ou para o Bug.

🤖 Bem-vindo, ${user}.
Não teste a paciência de um zenin
Se estiveres a testar-me, parabéns… funciono (às vezes).`;

    await sock.sendMessage(jid, { text }, { quoted: msg });
  },
};
