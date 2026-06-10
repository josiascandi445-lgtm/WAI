export default {
  name: "info2",
  description: "Informações avançadas do utilizador (perfil + stats + grupo + XP)",

  async execute({ sock, msg, jid, sender, isGroup }) {

    try {
      const number = sender?.split("@")[0];

      // 👤 Nome do utilizador + foto
      let username = "Desconhecido";
      let profilePic = null;

      try {
        const pp = await sock.profilePictureUrl(sender, "image");
        profilePic = pp;
      } catch (e) {
        profilePic = null;
      }

      try {
        const contact = await sock.onWhatsApp(sender);
        username = contact?.[0]?.notify || number;
      } catch (e) {
        username = number;
      }

      // 👥 Grupo info
      let groupName = "Privado";
      let participantCount = null;

      if (isGroup) {
        try {
          const metadata = await sock.groupMetadata(jid);
          groupName = metadata.subject;
          participantCount = metadata.participants?.length;
        } catch (e) {
          groupName = "Grupo desconhecido";
        }
      }

      // 🧠 XP fake (base simples local — podes evoluir depois)
      const xp = Math.floor(Math.random() * 1000);
      const level = Math.floor(xp / 100);

      const text =
`🧾 *PERFIL AVANÇADO*

👤 *Nome:* ${username}
📱 *Número:* ${number}
💬 *Chat:* ${isGroup ? "Grupo" : "Privado"}
🏷️ *Nome do grupo:* ${groupName}
👥 *Participantes:* ${participantCount || "N/A"}

🎮 *Nível:* ${level}
⭐ *XP:* ${xp}

🤖 *Status:* Online (infelizmente)`;

      if (profilePic) {
        await sock.sendMessage(jid, {
          image: { url: profilePic },
          caption: text
        }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, {
          text
        }, { quoted: msg });
      }

    } catch (err) {
      console.log("info2 error:", err);

      await sock.sendMessage(jid, {
        text: "💥 erro ao carregar info avançada"
      }, { quoted: msg });
    }
  }
};
