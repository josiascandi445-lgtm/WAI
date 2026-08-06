/**
 * commands/addoff.js
 *
 * Desactiva o sistema ADD RACE no grupo — pára a detecção e as
 * mensagens automáticas, mas NUNCA apaga dados (estatísticas, histórico
 * de competições, competição actual). Basta ".addon" outra vez para
 * retomar exactamente de onde ficou.
 */
import { isAdmin, isOwner } from "../lib/groupUtils.js";
import { loadData, saveData, getGroupState } from "../lib/addRaceData.js";

export default {
  name: "addoff",
  description: "Desactiva o ADD RACE neste grupo (dados são preservados)",

  async execute({ sock, jid, msg, sender, rawSender, isGroup }) {
    if (!isGroup) {
      return sock.sendMessage(jid, { text: "❌ Este comando só funciona em grupos." }, { quoted: msg });
    }

    const allowed = (await isAdmin(sock, jid, rawSender ?? sender)) || (await isOwner(sender, sock));
    if (!allowed) {
      return sock.sendMessage(jid, {
        text: "❌ Só administradores do grupo (ou o dono do bot) podem desactivar o ADD RACE.",
      }, { quoted: msg });
    }

    const data = loadData();
    const groupState = getGroupState(data, jid);

    if (!groupState.enabled) {
      return sock.sendMessage(jid, { text: "ℹ️ O ADD RACE já está desactivado neste grupo." }, { quoted: msg });
    }

    groupState.enabled = false;
    saveData(data);

    const hasCompetition = !!groupState.competition;
    await sock.sendMessage(jid, {
      text:
        "🛑 *ADD RACE desactivado.*\n\n" +
        "Deixei de contar novas adições e de enviar mensagens automáticas." +
        (hasCompetition ? "\n⚠️ A competição actual ficou em pausa — os dados dela foram preservados." : "") +
        "\n\nOs dados e o histórico continuam guardados. Usa *.addon* para reactivar.",
    }, { quoted: msg });
  },
};
