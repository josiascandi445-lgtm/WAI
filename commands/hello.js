import fs from "fs";

export default {
name: "hello",
aliases: ["ola", "hi", "salve"],
description: "Mensagem de saudação do bot",

async execute({ sock, msg, jid, sender, botName, prefix }) {

```
const user = sender.split("@")[0];

let botPic = null;

try {
  botPic = await sock.profilePictureUrl(
    sock.user.id,
    "image"
  );
} catch (err) {
  console.log("Sem foto de perfil do bot.");
}

const text =
```

`╭━━━〔 🤖 ${botName} 〕━━━⬣

👋 Olá, *${user}*

🚀 Estou online e pronto para ajudar.
Não gravo nome de Macho!

📌 Comandos disponíveis:
• ${prefix}help
• ${prefix}menu2
• ${prefix}info
• ${prefix}play
• ${prefix}song

━━━━━━━━━━━━━━

⚡ Estado: Online
🤖 Sistema: Operacional
👑 Dono: Bug
🔧 Prefixo: ${prefix}

💡 Digita *${prefix}help* para ver todos os comandos.

╰━━━━━━━━━━━━━━⬣`;

```
try {

  if (botPic) {

    await sock.sendMessage(
      jid,
      {
        image: { url: botPic },
        caption: text
      },
      { quoted: msg }
    );

  } else {

    await sock.sendMessage(
      jid,
      { text },
      { quoted: msg }
    );

  }

} catch (err) {

  console.log("[hello] erro:", err);

  await sock.sendMessage(
    jid,
    {
      text: `👋 Olá ${user}\n\nEstou online.\nUsa ${prefix}help para ver os comandos.`
    },
    { quoted: msg }
  );

}
```

}
};
