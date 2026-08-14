/**
 * lib/rpgData.js
 *
 * Persistência e regras do sistema RPG. Segue o mesmo padrão já usado em
 * warn.js (data/*.json com load/save simples e tolerante a falhas).
 *
 * Guardado GLOBALMENTE por jid do jogador (não por grupo) — a personagem
 * evolui em qualquer grupo onde o bot esteja, como na maioria dos bots
 * de RPG. Chave: jid completo (ex: "244911111111@s.whatsapp.net").
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = path.join(__dirname, "../data");
const DATA_FILE = path.join(DATA_DIR, "rpg.json");

export function loadPlayers() {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return {};
  }
}

export function savePlayers(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("[rpg] erro ao gravar dados:", err.message);
  }
}

/** XP necessária para subir DO nível `level` para o seguinte. Fórmula simples e crescente. */
export function xpForLevel(level) {
  return level * 100;
}

/** Devolve (criando se necessário) o objecto do jogador dentro de `players`. Muta `players`. */
export function getPlayer(players, jid) {
  if (!players[jid]) {
    players[jid] = { level: 1, xp: 0, coins: 0, lastWork: 0 };
  }
  // Robustez: dados antigos/corrompidos nunca devem derrubar o comando.
  const p = players[jid];
  if (typeof p.level !== "number" || p.level < 1) p.level = 1;
  if (typeof p.xp !== "number" || p.xp < 0) p.xp = 0;
  if (typeof p.coins !== "number" || p.coins < 0) p.coins = 0;
  if (typeof p.lastWork !== "number") p.lastWork = 0;
  return p;
}

/**
 * Aplica ganho de XP a um jogador, subindo de nível quantas vezes for
 * preciso (ex: um ganho grande pode subir 2 níveis de uma vez).
 * Muta `player` directamente. Devolve true se subiu pelo menos 1 nível.
 */
export function applyXp(player, xpGain) {
  player.xp += xpGain;
  let leveledUp = false;
  while (player.xp >= xpForLevel(player.level)) {
    player.xp -= xpForLevel(player.level);
    player.level += 1;
    leveledUp = true;
  }
  return leveledUp;
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
