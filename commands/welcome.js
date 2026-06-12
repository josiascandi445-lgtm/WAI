/**
 * Comando: .welcome
 * Apenas grupos. Apenas admins.
 * Envia mensagem de boas-vindas com foto e descrição do grupo.
 */
export default {
  name: "welcome",
  aliases: ["boasvindas"],
  description: "Envia mensagem de boas-vindas ao grupo (só admins)",

  async execute({ sock, jid, msg, sender, isGroup }) {
    if (!isGroup) {
      return sock.sendMessage(jid, {
        text: "❌ Este comando só funciona em grupos."
      }, { quoted: msg });
    }

    // Verificar se quem usou é admin
    const metadata    = await sock.groupMetadata(jid);
    const senderClean = sender.split("@")[0] + "@s.whatsapp.net";
    const isAdmin     = metadata.participants.some(
      p => p.id === senderClean && (p.admin === "admin" || p.admin === "superadmin")
    );

    if (!isAdmin) {
      return sock.sendMessage(jid, {
        text: "❌ Só os administradores podem usar este comando."
      }, { quoted: msg });
    }

    const groupName = metadata.subject || "o grupo";
    const desc      = metadata.desc
      ? metadata.desc.replace(/\r\n/g, "\n")
      : "Sem descrição definida.";

    // Contar membros e admins
    const totalMembros = metadata.participants.length;
    const totalAdmins  = metadata.participants.filter(p => p.admin).length;

    const texto =
`👋 *Sejam bem-vindos a ${groupName}!* 🎉

📖 *Leia a descrição do grupo:*
${desc}

━━━━━━━━━━━━━━━

📌 *Regras básicas:*
✅ Respeita todos os membros
✅ Sem spam ou publicidade não autorizada
✅ Partilha conteúdo relevante para o grupo
✅ Linguagem adequada sempre
❌ Sem ofensas, bullying ou conteúdo impróprio

━━━━━━━━━━━━━━━

👥 *Membros:* ${totalMembros}
👑 *Administradores:* ${totalAdmins}

❓ *Em caso de dúvida, contacta um dos admins.*

🤝 Fica à vontade e participa! Juntos somos mais fortes 💪`;

    try {
      const ppUrl = await sock.profilePictureUrl(jid, "image").catch(() => null);

      if (ppUrl) {
        await sock.sendMessage(jid, {
          image: { url: ppUrl },
          caption: texto
        }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text: texto }, { quoted: msg });
      }
    } catch (err) {
      console.error("[welcome] erro:", err.message);
      await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    }
  }
};
