/**
 * Comando: .avatar @user
 * Mostra foto de perfil de um utilizador.
 */
export default {
  name: "avatar",
  aliases: ["foto", "pp", "profile"],
  description: "Mostra a foto de perfil de um utilizador",

  async execute({ sock, jid, msg, args, sender }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
    let targetJid = mentioned[0] ?? sender;

    if (args.length && !mentioned.length) {
      const num = args[0].replace(/[^0-9]/g, "");
      if (num) targetJid = `${num}@s.whatsapp.net`;
    }

    try {
      const pp = await sock.profilePictureUrl(targetJid, "image");
      const number = targetJid.split("@")[0];

      await sock.sendMessage(jid, {
        image: { url: pp },
        caption: `🖼️ Foto de perfil de *+${number}*`
      }, { quoted: msg });

    } catch (err) {
      const number = targetJid.split("@")[0];
      await sock.sendMessage(jid, {
        text: `❌ Não foi possível obter a foto de *+${number}*.\n(Pode ter privacidade activada)`
      }, { quoted: msg });
    }
  }
};
