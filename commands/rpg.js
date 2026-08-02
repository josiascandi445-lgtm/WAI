/**
 * commands/rpg.js
 *
 * Sistema RPG leve: cada jogador tem nível, XP e moedas. A lógica de
 * dados (persistência, fórmula de XP) vive em lib/rpgData.js — este
 * ficheiro só trata do fluxo de comando/mensagens, seguindo o mesmo
 * padrão de outros comandos (ex: warn.js).
 *
 * Uso:
 *   .rpg                → mostra o teu perfil (cria personagem se não existir)
 *   .rpg trabalhar       → ganha moedas + XP (cooldown de 30 min)
 *   .rpg ranking         → top 5 jogadores por nível
 *
 * NOTA: desenhado para crescer sem tocar na lógica principal — uma loja/
 * inventário futuros só precisam de novos `case` aqui e um campo novo em
 * lib/rpgData.js (ex: player.inventory = []), sem alterar o resto.
 */
import { loadPlayers, savePlayers, getPlayer, applyXp, xpForLevel, randomInt } from "../lib/rpgData.js";

const WORK_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutos

async function handleRanking(sock, jid, msg, players) {
  const ranked = Object.entries(players)
    .sort(([, a], [, b]) => (b.level - a.level) || (b.xp - a.xp))
    .slice(0, 5);

  if (!ranked.length) {
    return sock.sendMessage(jid, {
      text: "📊 Ainda ninguém tem personagem. Usa *.rpg* para criares o teu!",
    }, { quoted: msg });
  }

  const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
  const lines = ranked.map(([playerJid, p], i) =>
    `${medals[i]} @${playerJid.split("@")[0]} — Nível *${p.level}* (${p.xp}/${xpForLevel(p.level)} XP, 💰${p.coins})`
  );

  await sock.sendMessage(jid, {
    text: `🏆 *Ranking RPG*\n\n${lines.join("\n")}`,
    mentions: ranked.map(([playerJid]) => playerJid),
  }, { quoted: msg });
}

async function handleWork(sock, jid, msg, players, sender) {
  const player = getPlayer(players, sender);
  const now = Date.now();
  const remaining = player.lastWork + WORK_COOLDOWN_MS - now;

  if (remaining > 0) {
    const mins = Math.ceil(remaining / 60_000);
    savePlayers(players); // grava mesmo assim (garante que a personagem nova fica registada)
    return sock.sendMessage(jid, {
      text: `⏳ Já foste trabalhar recentemente. Tenta de novo daqui a *${mins} min*.`,
    }, { quoted: msg });
  }

  const coinsGain = randomInt(50, 200);
  const xpGain    = randomInt(10, 30);
  player.coins   += coinsGain;
  player.lastWork = now;
  const leveledUp = applyXp(player, xpGain);
  savePlayers(players);

  let text = `💼 Foste trabalhar e ganhaste *${coinsGain} moedas* 💰 e *${xpGain} XP* ✨!`;
  if (leveledUp) text += `\n\n🎉 *Subiste para o nível ${player.level}!* 🎚️`;

  await sock.sendMessage(jid, { text }, { quoted: msg });
}

async function handleProfile(sock, jid, msg, players, sender) {
  const player = getPlayer(players, sender);
  savePlayers(players); // garante persistência mesmo numa 1ª consulta (criação da personagem)

  const number = sender.split("@")[0];
  const needed = xpForLevel(player.level);
  const filled = Math.round((player.xp / needed) * 10);
  const bar = "█".repeat(filled) + "░".repeat(10 - filled);

  const text =
    `🧙 *Perfil RPG — @${number}*\n\n` +
    `🎚️ Nível: *${player.level}*\n` +
    `✨ XP: ${player.xp}/${needed}\n` +
    `[${bar}]\n` +
    `💰 Moedas: *${player.coins}*\n\n` +
    `_Usa *.rpg trabalhar* para ganhar XP e moedas, ou *.rpg ranking* para ver o top 5._`;

  await sock.sendMessage(jid, { text, mentions: [sender] }, { quoted: msg });
}

export default {
  name: "rpg",
  description: "Sistema RPG: .rpg (perfil) | .rpg trabalhar | .rpg ranking",

  async execute({ sock, jid, msg, sender, args }) {
    const sub = (args[0] || "perfil").toLowerCase();
    const players = loadPlayers();

    try {
      if (["ranking", "top", "rank"].includes(sub)) {
        return await handleRanking(sock, jid, msg, players);
      }
      if (["trabalhar", "work", "trab"].includes(sub)) {
        return await handleWork(sock, jid, msg, players, sender);
      }
      return await handleProfile(sock, jid, msg, players, sender);
    } catch (err) {
      console.error("[rpg] erro:", err.message);
      await sock.sendMessage(jid, { text: "⚠️ Erro no sistema RPG. Tenta novamente." }, { quoted: msg });
    }
  },
};
