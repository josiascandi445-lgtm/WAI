export default {
  name: "hello",
  aliases: ["ola", "hi", "salve"],
  description: "Mensagem de saudação do bot",

  async execute({ sock, msg, jid, sender, botName, prefix }) {
    const user = sender.split("@")[0];
    const ownerName = process.env.OWNER_NAME || "Owner";

    const text =
`╭━━━〔 🤖 ${botName} 〕━━━╮
┃
┃ 👋 Olá, ${user}!
┃
┃ Estou online e operacional.
┃ Pronto para executar comandos,
┃ responder dúvidas e ajudar.
┃
┃ ⚙️  Prefixo: ${prefix}
┃ 📌 Usa ${prefix}help para ver comandos
┃
┃ ━━━━━━━━━━━━━━━━━
┃ 🔹 Status: Online
┃ 🔹 Dono: ${ownerName}
┃
╰━━━━━━━━━━━━━━━━━━━╯`;

    await sock.sendMessage(jid, { text }, { quoted: msg });
  },
};
