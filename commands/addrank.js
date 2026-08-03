/**
 * commands/addrank.js
 *
 * Consulta o ranking do ADD RACE a pedido (não é enviado automaticamente
 * a cada adição, para não gerar spam — ver handlers/onAddRace.js).
 * Se houver competição activa, mostra o ranking dessa competição;
 * senão, mostra o ranking do histórico geral (totalAllTime) do grupo.
 * Aberto a qualquer membro (só consulta, não altera nada).
 */
import { loadData, getGroupState, buildRanking } from "../lib/addRaceData.js";
import { buildRankingCard, extractMentions } from "../lib/addRaceCards.js";

export default {
  name: "addrank",
  aliases: ["addranking"],
  description: "Mostra o ranking do ADD RACE (competição activa, ou histórico geral)",

  async execute({ sock, jid, msg, isGroup }) {
    if (!isGroup) {
      return sock.sendMessage(jid, { text: "❌ Este comando só funciona em grupos." }, { quoted: msg });
    }

    const data = loadData();
    const groupState = getGroupState(data, jid);

    let ranking, goal;
    if (groupState.competition) {
      ranking = buildRanking(groupState.competition.participants);
      goal = groupState.competition.goal;
    } else {
      const totals = {};
      for (const [userJid, s] of Object.entries(groupState.stats)) totals[userJid] = s.totalAllTime;
      ranking = buildRanking(totals);
      goal = null;
    }

    await sock.sendMessage(jid, {
      text: buildRankingCard(ranking, goal),
      mentions: extractMentions(ranking),
    }, { quoted: msg });
  },
};
