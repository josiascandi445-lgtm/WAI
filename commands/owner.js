/**
 * Comando: .owner
 * Mostra informação de contacto do dono.
 */
export default {
  name: "owner",
  description: "Mostra o contacto do dono do bot",

  async execute({ sock, jid, msg, botName }) {
    const ownerNumber = process.env.OWNER_NUMBER || process.env.PAIRING_NUMBER || "";
    const ownerName   = process.env.OWNER_NAME   || "Owner";
    const clean = ownerNumber.replace(/[^0-9]/g, "");

    let text = `👑 *Dono de ${botName || "Bot"}*\n\n📛 Nome: ${ownerName}`;
    if (clean) text += `\n📱 Número: +${clean}`;

    await sock.sendMessage(jid, { text }, { quoted: msg });

    // Envia também como contacto clicável se tiver número
    if (clean) {
      try {
        await sock.sendMessage(jid, {
          contacts: {
            displayName: ownerName,
            contacts: [{ vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${ownerName}\nTEL;type=CELL;type=VOICE;waid=${clean}:+${clean}\nEND:VCARD` }]
          }
        }, { quoted: msg });
      } catch {}
    }
  }
};
