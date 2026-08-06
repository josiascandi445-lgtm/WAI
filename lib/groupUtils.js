/**
 * lib/groupUtils.js
 * Utilitários para operações de grupo — usados por ban, warn, welcome, etc.
 *
 * PORQUÊ: o WhatsApp usa @lid para linked devices mas os participants
 * no groupMetadata podem estar em @s.whatsapp.net. A comparação directa
 * de JIDs falha. Esta lib normaliza antes de comparar.
 */

// Extrai só o número de qualquer formato de JID
export function extractNumber(jid) {
  if (!jid) return "";
  return jid.replace(/@.*$/, "").replace(/[^0-9]/g, "");
}

// Resolve um @lid para o número de telefone real (@s.whatsapp.net), quando
// possível — usa o mapeamento GENUÍNO que o Baileys mantém internamente
// (sock.signalRepository.lidMapping), o mesmo mecanismo já usado em
// commands/certificado.js. Ao contrário de um regex ingénuo que troca só o
// sufixo "@lid" por "@s.whatsapp.net", isto não inventa números que não
// existem — se não houver mapeamento disponível, devolve o JID original.
export async function resolveRealJid(sock, jid) {
  if (!jid || !jid.endsWith("@lid")) return jid;
  try {
    const pn = await sock?.signalRepository?.lidMapping?.getPNForLID?.(jid);
    if (pn) return pn;
  } catch (err) {
    console.warn(`[groupUtils] não consegui resolver @lid → número real: ${err.message}`);
  }
  return jid; // sem mapeamento disponível — mantém o @lid original
}

// Verifica se um JID é o dono do bot (OWNER_NUMBER, ou PAIRING_NUMBER como fallback).
//
// IMPORTANTE (2025/2026): o WhatsApp passou a usar @lid também em chats
// privados (não só em grupos) para alguns números — nesses casos o
// remoteJid/participant que chega ao bot já não é o número de telefone
// real, e OWNER_NUMBER (que é sempre um número de telefone) nunca bate
// certo com a comparação directa. Por isso, se a comparação directa falhar
// e for passado um `sock`, tentamos resolver o @lid para o número real
// antes de decidir que não é o dono.
export async function isOwner(jid, sock) {
  const ownerRaw = process.env.OWNER_NUMBER || process.env.PAIRING_NUMBER || "";
  const ownerNum = extractNumber(ownerRaw);
  if (!ownerNum || !jid) return false;

  if (extractNumber(jid) === ownerNum) return true;

  if (sock && jid.endsWith("@lid")) {
    const resolved = await resolveRealJid(sock, jid);
    if (resolved !== jid && extractNumber(resolved) === ownerNum) return true;
  }

  return false;
}

// Compara 2 JIDs pelo número, ignorando sufixo de device (":12@...").
// Usada para saber se um JID corresponde ao próprio bot ou a outro utilizador.
export function sameNumber(jidA, jidB) {
  if (!jidA || !jidB) return false;
  const clean = (jid) => jid.replace(/:[\d]+@/, "@").replace(/@.*$/, "").replace(/[^0-9]/g, "");
  const numA = clean(jidA);
  const numB = clean(jidB);
  return numA !== "" && numA === numB;
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
