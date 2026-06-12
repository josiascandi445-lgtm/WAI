/**
 * Comando: .perfil / .profile
 * Mostra perfil detalhado de um utilizador:
 * foto, nome, número, bio (about), e se é admin no grupo.
 * Uso: .perfil @utilizador  ou  .perfil (sem arg = o próprio)
 */
export default {
  name: "perfil",
  aliases: ["profile", "ver"],
  description: "Mostra o perfil de um utilizador",

  async execute({ sock, jid, msg, sender, args, isGroup }) {
    // Determina o alvo
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
    let targetJid = mentioned[0] ?? null;

    if (!targetJid && args.length) {
      const n = args[0].replace(/[^0-9]/g, "");
      if (n) targetJid = `${n}@s.whatsapp.net`;
    }

    if (!targetJid) targetJid = sender;

    const number = targetJid.split("@")[0];

    try {
      // Foto de perfil
      let foto = null;
      try { foto = await sock.profilePictureUrl(targetJid, "image"); } catch {}

      // Bio / About
      let bio = "Sem biografia definida.";
      try {
        const status = await sock.fetchStatus(targetJid);
        if (status?.status) bio = status.status;
      } catch {}

      // Verificar admin no grupo
      let adminInfo = "";
      if (isGroup) {
        try {
          const meta = await sock.groupMetadata(jid);
          const p = meta.participants.find(p => p.id === targetJid);
          if (p?.admin === "superadmin") adminInfo = "\n👑 *Criador do grupo*";
          else if (p?.admin === "admin")  adminInfo = "\n🛡️ *Administrador*";
          else if (p)                      adminInfo = "\n👤 *Membro*";
          else                             adminInfo = "\n❓ *Não é membro deste grupo*";
        } catch {}
      }

      const texto =
`👤 *Perfil*

📱 Número: +${number}${adminInfo}
📝 Bio: _${bio}_`;

      if (foto) {
        await sock.sendMessage(jid, {
          image: { url: foto },
          caption: texto
        }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text: texto }, { quoted: msg });
      }

    } catch (err) {
      console.error("[perfil] erro:", err.message);
      await sock.sendMessage(jid, {
        text: "⚠️ Não consegui obter o perfil. O utilizador pode ter a privacidade activada."
      }, { quoted: msg });
    }
  }
};
