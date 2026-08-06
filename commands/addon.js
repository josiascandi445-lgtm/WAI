/**
 * commands/addon.js
 *
 * Activa o sistema ADD RACE no grupo. Uso:
 *   .addon       → activa só a contagem (sem competição)
 *   .addon 50    → activa (se preciso) e inicia uma competição com meta 50
 *
 * Só administradores do grupo ou o dono do bot podem usar este comando —
 * reaproveita lib/groupUtils.js (isAdmin/isOwner), sem sistema paralelo.
 */
import { isAdmin, isOwner } from "../lib/groupUtils.js";
import { loadData, saveData, getGroupState, parseGoal, MIN_GOAL, MAX_GOAL } from "../lib/addRaceData.js";
import { buildCompetitionStartCard } from "../lib/addRaceCards.js";

export default {
  name: "addon",
  description: "Activa o ADD RACE (.addon | .addon <meta>)",

  async execute({ sock, jid, msg, args, sender, rawSender, isGroup }) {
    if (!isGroup) {
      return sock.sendMessage(jid, { text: "❌ Este comando só funciona em grupos." }, { quoted: msg });
    }

    const allowed = (await isAdmin(sock, jid, rawSender ?? sender)) || (await isOwner(sender, sock));
    if (!allowed) {
      return sock.sendMessage(jid, {
        text: "❌ Só administradores do grupo (ou o dono do bot) podem activar o ADD RACE.",
      }, { quoted: msg });
    }

    const data = loadData();
    const groupState = getGroupState(data, jid);

    // ".addon" sem argumento — só activa a contagem, sem competição.
    if (!args.length) {
      if (groupState.enabled && !groupState.competition) {
        return sock.sendMessage(jid, { text: "ℹ️ O ADD RACE já está activo neste grupo." }, { quoted: msg });
      }
      groupState.enabled = true;
      saveData(data);
      return sock.sendMessage(jid, {
        text:
          "✅ *ADD RACE activado!*\n\n" +
          "Vou contar automaticamente quantos membros cada pessoa adiciona ao grupo.\n" +
          "Usa *.addon <número>* para iniciar uma competição com meta.",
      }, { quoted: msg });
    }

    // ".addon 50" — inicia competição.
    const goal = parseGoal(args[0]);
    if (goal === null) {
      return sock.sendMessage(jid, {
        text:
          `❌ Meta inválida.\n\n` +
          `Usa um número inteiro entre *${MIN_GOAL}* e *${MAX_GOAL}*.\n` +
          `Exemplo: .addon 50`,
      }, { quoted: msg });
    }

    if (groupState.competition) {
      const c = groupState.competition;
      return sock.sendMessage(jid, {
        text:
          `⚠️ Já existe uma competição activa neste grupo!\n\n` +
          `🎯 Meta actual: *${c.goal}*\n` +
          `👥 Participantes: *${Object.keys(c.participants).length}*\n\n` +
          `Usa *.addoff* e depois *.addon ${goal}* se quiseres substituir a competição actual.`,
      }, { quoted: msg });
    }

    groupState.enabled = true; // iniciar competição activa automaticamente a contagem também
    groupState.competition = {
      goal,
      startedAt: Date.now(),
      startedBy: sender,
      participants: {},
    };
    saveData(data);

    await sock.sendMessage(jid, { text: buildCompetitionStartCard(goal) }, { quoted: msg });
  },
};
