const antiLinkGroups = new Map();

export function enableAntiLink(jid) {
  antiLinkGroups.set(jid, true);
}

export function disableAntiLink(jid) {
  antiLinkGroups.set(jid, false);
}

export function isAntiLinkEnabled(jid) {
  return antiLinkGroups.get(jid) === true;
}

export function containsLink(text = "") {
  return /https?:\/\/\S+|www\.\S+|wa\.me\/\S+/i.test(text);
}

export async function handleAntiLink({ sock, msg, jid, sender, text, isGroup }) {
  if (!isGroup) return false;
  if (!isAntiLinkEnabled(jid)) return false;
  if (!containsLink(text)) return false;

  try {
    await sock.sendMessage(jid, {
      delete: {
        remoteJid: jid,
        fromMe: false,
        id: msg.key.id,
        participant: msg.key.participant
      }
    });

    await sock.sendMessage(jid, {
      text: `🚫 Link removido automaticamente\n👤 ${sender}`,
    });

    return true;
  } catch (err) {
    console.log("[anti-link] erro:", err);
    return false;
  }
}
