/**
 * handlers/onAddRace.js
 *
 * Processa o evento "group-participants.update" com action "add"
 * (despachado por onGroupParticipantsUpdate.js). Regista quem adicionou
 * quem, actualiza estatísticas/competição e envia o cartão visual.
 *
 * QUEM "ADICIONOU"? O Baileys dá-nos `author` (quem executou a acção) e
 * `participants` (quem foi adicionado). Quando alguém entra sozinho por
 * link de convite, o WhatsApp normalmente reporta essa pessoa como
 * author DE SI PRÓPRIA — nesse caso não há "quem adicionou" a contar
 * (ninguém convidou activamente), por isso excluímos participantes que
 * sejam o próprio author. Sem `author` (evento sem essa informação),
 * também não há como atribuir a ninguém — ignoramos em silêncio.
 *
 * DEDUPE: mesmo padrão já usado no evento de despedida (janela curta em
 * memória) — cobre reconexões que reentregam o mesmo evento. Só é
 * aplicado DEPOIS de confirmar que o grupo tem o sistema activado —
 * assim, um evento recebido enquanto está desligado nunca "gasta" a
 * protecção contra duplicados, e uma reactivação (.addon) mais tarde
 * continua a contar tudo correctamente. Isto NÃO precisa de sobreviver
 * a um restart real do processo: o cenário do Baileys reentregar o
 * mesmo evento acontece dentro da mesma sessão de ligação, não entre
 * reinícios (o histórico persistido em si sobrevive a restarts
 * perfeitamente — ver lib/addRaceData.js).
 */
import { sameNumber } from "../lib/groupUtils.js";
import {
  loadData, saveData, getGroupState,
  recordAddition, checkAndCloseCompetitionIfWon, buildRanking,
} from "../lib/addRaceData.js";
import {
  buildStatsCard, buildCompetitionProgressCard,
  buildCompetitionStartCard, buildWinnerCard, extractMentions,
} from "../lib/addRaceCards.js";

const DEDUPE_WINDOW_MS = 15_000;
const recentlyAdded = new Map(); // chave: "grupoJid:participanteJid:add" → timestamp

function isDuplicate(key) {
  const now = Date.now();
  for (const [k, ts] of recentlyAdded) {
    if (now - ts > DEDUPE_WINDOW_MS) recentlyAdded.delete(k);
  }
  if (recentlyAdded.has(key)) return true;
  recentlyAdded.set(key, now);
  return false;
}

/**
 * @param {import("@whiskeysockets/baileys").WASocket} sock
 * @param {string} groupJid
 * @param {string[]} participants — JIDs adicionados neste evento
 * @param {string|undefined} authorJid — quem executou a acção (pode faltar)
 */
export async function handleParticipantsAdded(sock, groupJid, participants, authorJid) {
  if (!authorJid) {
    console.log(`[addrace] evento 'add' sem author em ${groupJid} — ignorado (não atribuível)`);
    return;
  }

  const data = loadData();
  const groupState = getGroupState(data, groupJid);

  if (!groupState.enabled) {
    // Sistema desligado neste grupo — nem sequer regista no cache de
    // dedupe, para que uma reactivação posterior (.addon) não perca a
    // contagem de eventos que chegarem entretanto.
    return;
  }

  const countable = [];
  for (const p of participants) {
    if (sameNumber(p, authorJid)) continue; // entrou sozinho — não conta como "adicionado por alguém"
    if (sameNumber(p, sock.user?.id)) continue; // o próprio bot a ser adicionado — nunca conta

    const dedupeKey = `${groupJid}:${p}:add`;
    if (isDuplicate(dedupeKey)) {
      console.log(`[addrace] duplicado ignorado: ${dedupeKey}`);
      continue;
    }
    countable.push(p);
  }

  if (!countable.length) return;

  const summary = recordAddition(groupState, authorJid, countable.length);
  console.log(`[addrace] ${authorJid} adicionou ${countable.length} em ${groupJid} (hoje: ${summary.today}, total: ${summary.total})`);

  // Verifica vitória ANTES de gravar a mensagem de progresso normal —
  // se atingiu a meta, só a mensagem de vitória é enviada (não as duas).
  const won = checkAndCloseCompetitionIfWon(groupState, authorJid);
  saveData(data);

  try {
    if (won) {
      const card = buildWinnerCard({ winnerJid: authorJid, goal: won.goal, finalRanking: won.finalRanking });
      await sock.sendMessage(groupJid, { text: card, mentions: extractMentions(won.finalRanking) });
      return;
    }

    if (summary.competitionProgress !== null) {
      const miniRanking = buildRanking(groupState.competition.participants, 3);
      const card = buildCompetitionProgressCard({
        adderJid: authorJid,
        addedNow: countable.length,
        progress: summary.competitionProgress,
        goal: groupState.competition.goal,
        miniRanking,
      });
      await sock.sendMessage(groupJid, { text: card, mentions: [authorJid, ...extractMentions(miniRanking)] });
    } else {
      const card = buildStatsCard({
        adderJid: authorJid,
        addedNow: countable.length,
        today: summary.today,
        total: summary.total,
      });
      await sock.sendMessage(groupJid, { text: card, mentions: [authorJid] });
    }
  } catch (err) {
    console.error(`[addrace] erro ao enviar cartão em ${groupJid}:`, err.message);
  }
}
