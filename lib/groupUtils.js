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

// Verifica se um JID é o dono do bot (OWNER_NUMBER, ou PAIRING_NUMBER como fallback).
//
// CAUSA DE UM BUG JÁ VISTO: quando o WhatsApp entrega a mensagem do
// próprio dono com um JID @lid (Linked ID) em vez do número de telefone
// real (comportamento cada vez mais comum, já documentado noutros
// sítios deste projecto — ver getSender() em handlers/onMessage.js), a
// comparação directa com OWNER_NUMBER falhava sempre, mesmo sendo
// mesmo o dono a usar o comando.
//
// FIX: se o jid for @lid, tenta primeiro resolver o número real via
// sock.signalRepository.lidMapping (mesma técnica já usada no
// .certificado) antes de desistir. Sem "sock" (uso síncrono antigo),
// continua a funcionar como antes para JIDs normais.
export async function isOwner(jid, sock) {
  const ownerRaw = process.env.OWNER_NUMBER || process.env.PAIRING_NUMBER || "";
  const ownerNum = extractNumber(ownerRaw);
  const ownerLid = process.env.OWNER_LID || ""; // ver .env.example — override directo, sem depender de resolução

  if (!jid) return false;

  // Override directo — sempre correcto, não depende de nenhuma resolução
  // do Baileys (que é "melhor esforço" e pode falhar de forma
  // imprevisível, ver nota abaixo). Se OWNER_LID estiver definido e o
  // jid corresponder, aceita já sem mais verificações.
  if (ownerLid && jid === ownerLid) return true;

  if (!ownerNum) return false;

  if (extractNumber(jid) === ownerNum) return true;

  if (jid.endsWith("@lid")) {
    if (sock) {
      try {
        const pn = await sock?.signalRepository?.lidMapping?.getPNForLID?.(jid);
        if (pn && extractNumber(pn) === ownerNum) return true;
      } catch {
        // mapeamento indisponível — não é um erro, só não conseguimos confirmar por esta via
      }
    }
    // Ajuda a diagnosticar: se chegou aqui, é um @lid que não bateu
    // certo com OWNER_NUMBER nem foi resolvido. Regista o JID exacto
    // para poderes copiá-lo para OWNER_LID no .env, sem tentativa e erro.
    console.log(`[isOwner] @lid não reconhecido como dono: ${jid} — se for mesmo o dono, define OWNER_LID="${jid}" no .env`);
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
