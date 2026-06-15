import { isAdmin } from "../lib/groupUtils.js";

export default {
  name: "welcome",
  aliases: ["boasvindas"],
  description: "Envia mensagem de boas-vindas ao grupo (só admins)",

  async execute({ sock, jid, msg, sender, rawSender, isGroup }) {
    if (!isGroup) {
      return sock.sendMessage(jid, { text: "❌ Este comando só funciona em grupos." }, { quoted: msg });
    }

    const senderIsAdmin = await isAdmin(sock, jid, rawSender ?? sender);
    if (!senderIsAdmin) {
      return sock.sendMessage(jid, { text: "❌ Só os administradores podem usar este comando." }, { quoted: msg });
    }

    try {
      const metadata    = await sock.groupMetadata(jid);
      const groupName   = metadata.subject || "o grupo";
      const desc        = metadata.desc?.replace(/\r\n/g, "\n") || "Sem descrição definida.";
      const totalMembros = metadata.participants.length;
      const totalAdmins  = metadata.participants.filter(p => p.admin).length;

      const texto =
`👋 *Sejam bem-vindos a ${groupName}!* 🎉

📖 *Leia a descrição do grupo:*
${desc}

━━━━━━━━━━━━━━

📌 *Regras básicas:*
✅ Respeita todos os membros
✅ Sem spam ou publicidade não autorizada
✅ Partilha conteúdo relevante para o grupo
✅ Linguagem adequada sempre
❌ Sem ofensas, bullying ou conteúdo impróprio

━━━━━━━━━━━━━━

👥 *Membros:* ${totalMembros}
👑 *Administradores:* ${totalAdmins}

❓ *Em caso de dúvida, contacta um dos admins.*
🤝 Bem-vindo e boa participação! 💪`;

      const ppUrl = await sock.profilePictureUrl(jid, "image").catch(() => null);

      if (ppUrl) {
        await sock.sendMessage(jid, { image: { url: ppUrl }, caption: texto }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text: texto }, { quoted: msg });
      }
    } catch (err) {
      console.error("[welcome] erro:", err.message);
      await sock.sendMessage(jid, { text: "⚠️ Erro ao obter informações do grupo." }, { quoted: msg });
    }
  }
};
