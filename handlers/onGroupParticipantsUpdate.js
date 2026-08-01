/**
 * handlers/onGroupParticipantsUpdate.js
 *
 * Reage ao evento nativo do Baileys "group-participants.update" quando a
 * acção é "remove" (participante saiu OU foi removido — o WhatsApp não
 * distingue os dois casos neste evento; ambos disparam a despedida).
 *
 * Fluxo:
 *   1. Ignora tudo o que não for um grupo (@g.us) ou não for "remove".
 *   2. Ignora se o próprio bot for o participante removido (não há grupo
 *      para responder).
 *   3. Deduplica — o mesmo (grupo, participante) só gera UMA mensagem
 *      dentro de uma janela curta, mesmo que o Baileys reentregue o
 *      evento (acontece ocasionalmente após reconexões).
 *   4. Escolhe um modelo aleatório (lib/farewellMessages.js).
 *   5. Envia com "mentions" real do Baileys — o WhatsApp reconhece a
 *      menção porque o JID em `mentions` corresponde ao "@numero" no texto.
 */
import { getRandomFarewell } from "../lib/farewellMessages.js";

const DEDUPE_WINDOW_MS = 15_000;
const recentlyHandled = new Map(); // chave: "grupoJid:participanteJid" → timestamp

function isDuplicate(key) {
  const now = Date.now();
  for (const [k, ts] of recentlyHandled) {
    if (now - ts > DEDUPE_WINDOW_MS) recentlyHandled.delete(k);
  }
  if (recentlyHandled.has(key)) return true;
  recentlyHandled.set(key, now);
  return false;
}

function sameNumber(jidA, jidB) {
  if (!jidA || !jidB) return false;
  // Remove primeiro o sufixo de device (":12@...") antes de extrair dígitos —
  // sock.user.id vem como "244900000000:12@s.whatsapp.net"; sem isto, o "12"
  // do device ficava colado ao número e a comparação falhava sempre.
  const clean = (jid) => jid.replace(/:[\d]+@/, "@").replace(/@.*$/, "").replace(/[^0-9]/g, "");
  const numA = clean(jidA);
  const numB = clean(jidB);
  return numA !== "" && numA === numB;
}

/**
 * @param {import("@whiskeysockets/baileys").WASocket} sock
 * @param {{ id: string, participants: string[], action: string }} update
 */
export async function handleGroupParticipantsUpdate(sock, update) {
  const { id: groupJid, participants, action } = update || {};

  if (action !== "remove") return;               // só nos interessa quem SAIU
  if (!groupJid || !groupJid.endsWith("@g.us")) return; // nunca em privado
  if (!Array.isArray(participants) || !participants.length) return;

  for (const participantJid of participants) {
    try {
      // O próprio bot foi removido do grupo — não há onde enviar a mensagem.
      if (sameNumber(participantJid, sock.user?.id)) continue;

      const dedupeKey = `${groupJid}:${participantJid}`;
      if (isDuplicate(dedupeKey)) {
        console.log(`[farewell] duplicado ignorado: ${dedupeKey}`);
        continue;
      }

      const tag  = participantJid.split("@")[0];
      const text = getRandomFarewell(`@${tag}`);

      await sock.sendMessage(groupJid, {
        text,
        mentions: [participantJid],
      });

      console.log(`[farewell] 👋 enviado em ${groupJid} para ${participantJid}`);
    } catch (err) {
      // Nunca deixar um erro aqui derrubar a ligação do Baileys.
      console.error(`[farewell] erro ao processar saída de ${participantJid}:`, err.message);
    }
  }
}
