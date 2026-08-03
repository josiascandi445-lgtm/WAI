/**
 * lib/addRaceData.js
 *
 * Persistência e regras de dados do sistema ADD RACE. Segue o mesmo
 * padrão já usado em warn.js/rpgData.js (JSON em data/), mas com escrita
 * ATÓMICA (escreve num ficheiro temporário e só depois renomeia) — para
 * este sistema em particular isso importa mais, porque um crash a meio
 * de uma escrita normal podia corromper o ficheiro e perder o histórico
 * de todos os grupos, não só de um.
 *
 * Estrutura persistida (data/addrace.json):
 * {
 *   "<groupJid>": {
 *     "enabled": boolean,
 *     "stats": {
 *       "<userJid>": { "totalAllTime": number, "today": { "date": "YYYY-MM-DD", "count": number } }
 *     },
 *     "competition": null | {
 *       "goal": number, "startedAt": number, "startedBy": "<jid>",
 *       "participants": { "<userJid>": number }
 *     },
 *     "pastCompetitions": [
 *       { "goal", "winner", "reachedAt", "participants", "finalRanking",
 *         "startedAt", "startedBy", "endedAt" }
 *     ]
 *   }
 * }
 *
 * Estatísticas gerais (stats) e competição actual (competition) são
 * guardadas em campos SEPARADOS de propósito (secção 10 do pedido) — o
 * fim de uma competição nunca apaga nem mistura o histórico geral.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = path.join(__dirname, "../data");
const DATA_FILE = path.join(DATA_DIR, "addrace.json");

const MIN_GOAL = 1;
const MAX_GOAL = 100_000; // limite razoável — evita metas absurdas por engano ou abuso

export function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (err) {
    console.error("[addrace] erro ao ler dados, a continuar com estado vazio:", err.message);
    return {};
  }
}

/** Escrita atómica: grava num .tmp e só substitui o ficheiro real no fim. */
export function saveData(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmpFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2));
    fs.renameSync(tmpFile, DATA_FILE); // rename é atómico no mesmo sistema de ficheiros
  } catch (err) {
    console.error("[addrace] erro ao gravar dados:", err.message);
  }
}

/** Data de "hoje" estável (UTC) — nunca depende do fuso horário do processo/host. */
export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/** Devolve (criando se necessário) o estado de um grupo. Muta `data`. */
export function getGroupState(data, groupJid) {
  if (!data[groupJid]) {
    data[groupJid] = { enabled: false, stats: {}, competition: null, pastCompetitions: [] };
  }
  const g = data[groupJid];
  if (typeof g.enabled !== "boolean") g.enabled = false;
  if (!g.stats || typeof g.stats !== "object") g.stats = {};
  if (!Array.isArray(g.pastCompetitions)) g.pastCompetitions = [];
  return g;
}

function getUserStats(groupState, userJid) {
  if (!groupState.stats[userJid]) {
    groupState.stats[userJid] = { totalAllTime: 0, today: { date: todayKey(), count: 0 } };
  }
  const s = groupState.stats[userJid];
  if (s.today.date !== todayKey()) {
    s.today = { date: todayKey(), count: 0 }; // novo dia — reinicia o contador diário
  }
  return s;
}

/**
 * Valida e normaliza o argumento numérico de ".addon 50".
 * @returns {number|null} a meta válida, ou null se inválida
 */
export function parseGoal(raw) {
  if (!/^\d+$/.test(String(raw ?? ""))) return null; // rejeita "abc", "-10", "3.5", vazio...
  const n = parseInt(raw, 10);
  if (n < MIN_GOAL || n > MAX_GOAL) return null;
  return n;
}

export { MIN_GOAL, MAX_GOAL };

/**
 * Regista uma adição de `count` participantes feita por `adderJid` no
 * grupo. Actualiza estatísticas gerais SEMPRE; actualiza a competição
 * activa também, se houver uma. Muta `groupState`. Devolve um resumo
 * usado para construir a mensagem/cartão.
 */
export function recordAddition(groupState, adderJid, count) {
  const stats = getUserStats(groupState, adderJid);
  stats.totalAllTime += count;
  stats.today.count += count;

  let competitionProgress = null;
  if (groupState.competition) {
    const comp = groupState.competition;
    comp.participants[adderJid] = (comp.participants[adderJid] || 0) + count;
    competitionProgress = comp.participants[adderJid];
  }

  return {
    addedNow: count,
    today: stats.today.count,
    total: stats.totalAllTime,
    competitionProgress, // null se não houver competição activa
  };
}

/**
 * Se houver competição activa e `adderJid` já atingiu a meta, encerra a
 * competição, arquiva-a em pastCompetitions e devolve os dados do
 * vencedor + ranking final. Devolve null se ninguém atingiu a meta ainda
 * (ou se não há competição activa).
 */
export function checkAndCloseCompetitionIfWon(groupState, adderJid) {
  const comp = groupState.competition;
  if (!comp) return null;

  const progress = comp.participants[adderJid] || 0;
  if (progress < comp.goal) return null;

  const finalRanking = buildRanking(comp.participants);

  const archived = {
    goal: comp.goal,
    winner: adderJid,
    reachedAt: Date.now(),
    participants: comp.participants,
    finalRanking,
    startedAt: comp.startedAt,
    startedBy: comp.startedBy,
    endedAt: Date.now(),
  };

  groupState.pastCompetitions.push(archived);
  groupState.competition = null; // encerrada — próxima competição começa do zero

  return archived;
}

/** Ordena participantes por contagem desc. Devolve [{ jid, count }]. */
export function buildRanking(participantsObj, limit = 10) {
  return Object.entries(participantsObj || {})
    .map(([jid, count]) => ({ jid, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
