export default {
  name: "info",
  description: "Mostra informações úteis sobre o utilizador e chat.",

  async execute({ sock, msg, jid, sender, isGroup, botName }) {

    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    // 🔥 limpa o número (remove @s.whatsapp.net)
    const number = sender?.split("@")[0];

    let groupName = "Privado";

    // tenta obter nome do grupo (se for grupo)
    if (isGroup) {
      try {
        const metadata = await sock.groupMetadata(jid);
        groupName = metadata.subject;
      } catch (e) {
        groupName = "Grupo (não foi possível obter nome)";
      }
    }

    const text =
`ℹ️ *Informações úteis*

👤 *Utilizador:* ${number}
💬 *Tipo:* ${isGroup ? "Grupo" : "Privado"}
🏷️ *Chat:* ${groupName}

🤖 *Bot:* ${botName || "Bot"}
⏱️ *Uptime:* ${hours}h ${minutes}m ${seconds}s
🧠 *Node.js:* ${process.version}`;

    await sock.sendMessage(jid, {
      text
    }, { quoted: msg });
  }
};
