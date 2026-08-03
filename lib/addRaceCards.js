/**
 * lib/addRaceCards.js
 *
 * Construção dos cartões visuais do ADD RACE. Funções puras (sem I/O) —
 * a lógica de deteção/persistência nunca constrói texto directamente,
 * só chama estas funções. Separado de propósito, para poder afinar o
 * design sem tocar em handlers/onAddRace.js.
 */

const MEDALS = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

function progressBar(current, goal, size = 10) {
  const ratio = Math.max(0, Math.min(1, goal > 0 ? current / goal : 0));
  const filled = Math.round(ratio * size);
  return "█".repeat(filled) + "░".repeat(size - filled);
}

function tag(jid) {
  return `@${jid.split("@")[0]}`;
}

/** Cartão simples — sem competição activa (só estatísticas gerais). */
export function buildStatsCard({ adderJid, addedNow, today, total }) {
  return (
    `╭━━━〔 👥 *ADD RACE* 〕━━━╮\n\n` +
    `👤 Membro: ${tag(adderJid)}\n\n` +
    `➕ Adicionados agora: *${addedNow}* membro${addedNow === 1 ? "" : "s"}\n\n` +
    `📅 Hoje: *${today}* membros\n` +
    `🏆 Total: *${total}* membros\n\n` +
    `🔥 Continue adicionando!\n\n` +
    `╰━━━━━━━━━━━━━━━━━━╯`
  );
}

/** Cartão de progresso — com competição activa. */
export function buildCompetitionProgressCard({ adderJid, addedNow, progress, goal, miniRanking }) {
  const remaining = Math.max(0, goal - progress);
  const bar = progressBar(progress, goal);

  let text =
    `╭━━━〔 🏆 *ADD RACE* 〕━━━╮\n\n` +
    `👤 ${tag(adderJid)}\n\n` +
    `➕ Adicionados agora: *${addedNow}*\n\n` +
    `📊 Progresso:\n` +
    `${progress} / ${goal}\n` +
    `[${bar}]\n\n`;

  text += remaining > 0
    ? `🔥 Faltam: *${remaining}* membros!\n\n`
    : `✅ Meta atingida!\n\n`;

  if (miniRanking?.length) {
    text += `🏅 Top 3 agora:\n`;
    text += miniRanking.slice(0, 3).map((r, i) => `${MEDALS[i]} ${tag(r.jid)} — ${r.count}/${goal}`).join("\n");
    text += `\n\n`;
  }

  text += `🎁 Continue adicionando!\n\n╰━━━━━━━━━━━━━━━━━━╯`;
  return text;
}

/** Cartão de início de competição (".addon 50"). */
export function buildCompetitionStartCard(goal) {
  return (
    `╭━━━〔 🏆 *ADD RACE INICIADA!* 〕━━━╮\n\n` +
    `🎯 Meta: *${goal}* membros\n\n` +
    `👥 Adicione membros ao grupo para entrar no ranking!\n\n` +
    `🥇 O primeiro a atingir *${goal}/${goal}* vence!\n\n` +
    `╰━━━━━━━━━━━━━━━━━━╯`
  );
}

/** Cartão de vitória — quando alguém atinge a meta. */
export function buildWinnerCard({ winnerJid, goal, finalRanking }) {
  const rankingLines = finalRanking
    .slice(0, 3)
    .map((r, i) => `${MEDALS[i]} ${tag(r.jid)} — ${r.count}`)
    .join("\n");

  return (
    `╭━━━〔 🏆 *META ATINGIDA!* 〕━━━╮\n\n` +
    `🎉 *TEMOS UM VENCEDOR!* 🎉\n\n` +
    `👑 Campeão: ${tag(winnerJid)}\n` +
    `🔥 Adicionou *${goal}* membros!\n\n` +
    `🥇 *PRIMEIRO A ATINGIR A META!*\n` +
    `🎁 *PARABÉNS!*\n\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `🏆 Ranking final:\n\n` +
    `${rankingLines}\n\n` +
    `╰━━━━━━━━━━━━━━━━━━╯`
  );
}

/** Cartão de ranking sob pedido (".addrank"). */
export function buildRankingCard(ranking, goal) {
  if (!ranking.length) {
    return `📊 *ADD RACE*\n\nAinda não há nenhuma adição registada${goal ? ` nesta competição (meta: ${goal})` : ""}.`;
  }

  const lines = ranking
    .slice(0, 10)
    .map((r, i) => `${MEDALS[i] ?? `${i + 1}.`} ${tag(r.jid)} — ${r.count}${goal ? `/${goal}` : ""}`)
    .join("\n");

  return (
    `╭━━━〔 🏆 *RANKING ADD RACE* 〕━━━╮\n\n` +
    `${lines}\n\n` +
    `╰━━━━━━━━━━━━━━━━━━╯`
  );
}

export function extractMentions(ranking) {
  return ranking.map(r => r.jid);
}
