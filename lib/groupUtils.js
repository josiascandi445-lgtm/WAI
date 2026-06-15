/**
 * lib/groupUtils.js
 * Utilitários para operações de grupo — usados por ban, warn, welcome, etc.
 *
 * PORQUÊ: o WhatsApp usa @lid para linked devices mas os participants
 * no groupMetadata podem estar em @s.whatsapp.net. A comparação directa
 * de JIDs falha. Esta lib normaliza antes de comparar.
 */

// Extrai só o número de qualquer formato de JID
function extractNumber(jid) {
  if (!jid) return "";
  return jid.replace(/@.*$/, "").replace(/[^0-9]/g, "");
}

// Verifica se um JID é admin num grupo — robusto a @lid vs @s.whatsapp.net
export async function isAdmin(sock, groupJid, userJid) {
  try {
    const meta = await sock.groupMetadata(groupJid);
    const userNum = extractNumber(userJid);

    return meta.participants.some(p => {
      if (!p.admin) return false;
      const pNum = extractNumber(p.id);
      return pNum === userNum || p.id === userJid;
    });
  } catch {
    return false;
  }
}

// Verifica se o BOT é admin
export async function isBotAdmin(sock, groupJid) {
  try {
    const meta = await sock.groupMetadata(groupJid);
    const botNum = extractNumber(sock.user?.id ?? "");

    return meta.participants.some(p => {
      if (!p.admin) return false;
      const pNum = extractNumber(p.id);
      return pNum === botNum || p.id === sock.user?.id;
    });
  } catch {
    return false;
  }
}

// Procura o JID completo de um participante pelo número
export async function findParticipantJid(sock, groupJid, numberOrJid) {
  try {
    const meta = await sock.groupMetadata(groupJid);
    const num = extractNumber(numberOrJid);
    const found = meta.participants.find(p => extractNumber(p.id) === num);
    return found?.id ?? null;
  } catch {
    return null;
  }
}
