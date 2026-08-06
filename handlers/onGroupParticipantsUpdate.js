/**
 * handlers/onGroupParticipantsUpdate.js
 *
 * Ponto único de dispatch do evento nativo do Baileys
 * "group-participants.update", partilhado por duas funcionalidades:
 *
 *   - action "remove" → mensagem de despedida (lib/farewellMessages.js)
 *   - action "add"    → sistema ADD RACE (handlers/onAddRace.js)
 *
 * Um só listener registado em lib/whatsapp.js, despachado aqui consoante
 * a acção — evita ter dois "sock.ev.on('group-participants.update', ...)"
 * a competir.
 *
 * Despedida (action "remove"):
 *   1. Ignora se o próprio bot for o participante removido.
 *   2. Deduplica — o mesmo (grupo, participante) só gera UMA mensagem
 *      dentro de uma janela curta, mesmo que o Baileys reentregue o
 *      evento (acontece ocasionalmente após reconexões).
 *   3. Escolhe um modelo aleatório e envia com "mentions" real.
 */
import { getRandomFarewell } from "../lib/farewellMessages.js";
import { sameNumber } from "../lib/groupUtils.js";
import { handleParticipantsAdded } from "./onAddRace.js";
import { isBotEnabled } from "../lib/botState.js";

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

export async function handleGroupParticipantsUpdate(sock, update) {
  if (!isBotEnabled()) return; // bot desligado (.off) — sem despedidas, sem ADD RACE

  const { id: groupJid, participants, action, author } = update || {};

  if (!groupJid || !groupJid.endsWith("@g.us")) return; // nunca em privado
  if (!Array.isArray(participants) || !participants.length) return;

  if (action === "add") {
    try {
      await handleParticipantsAdded(sock, groupJid, participants, author);
    } catch (err) {
      console.error(`[addrace] erro ao processar adição em ${groupJid}:`, err.message);
    }
    return;
  }

  if (action !== "remove") return; // só nos interessa quem SAIU (despedida)

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
