export default {
  name: "hello",
  aliases: ["ola", "hi", "salve"],
  description: "Mensagem de saudação do bot",

  async execute({ sock, msg, jid, sender, botName, prefix }) {
    const user = sender.split("@")[0];

    const text =
`╭━━━〔 🤖 ${botName} 〕━━━╮
┃
┃ 👋 Olá, ${user}
┃
┃ Estou online e operacional.
┃ Pronto para executar comandos,
┃ responder dúvidas e ajudar no que for necessário.
┃ Não gravo nome de macho
┃
┃ ⚙️ Prefixo atual: ${prefix}
┃ 📌 Use ${prefix}help para ver comandos disponíveis
┃
┃ ━━━━━━━━━━━━━━━━━━━
┃ 🔹 Status: Online
┃ 🔹 Modo: Ativo
┃ 🔹 Dono: Bug
┃
┃ 💡 Desenvolvido para automação e suporte
╰━━━━━━━━━━━━━━━━━━━━╯`;

    await sock.sendMessage(
      jid,
      { text },
      { quoted: msg }
    );
  },
};
