/**
 * lib/botState.js
 *
 * Estado global do bot (ligado/desligado) — controlado por .on/.off
 * (commands/on.js, commands/off.js), só o dono pode alterar.
 *
 * Persistente (data/botstate.json), para sobreviver a reinícios: se o
 * dono desligou o bot deliberadamente, um crash/redeploy não deve
 * religá-lo sozinho.
 *
 * Cache em memória para não ler o disco a cada mensagem recebida — só
 * volta a ler se ainda não tiver sido carregado nesta execução do
 * processo; a escrita (setBotEnabled) actualiza a cache e o ficheiro
 * ao mesmo tempo.
 *
 * Usado em dois pontos:
 *   - handlers/onMessage.js         → bloqueia comandos quando desligado
 *   - handlers/onGroupParticipantsUpdate.js → bloqueia despedidas/ADD RACE
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = path.join(__dirname, "../data");
const DATA_FILE = path.join(DATA_DIR, "botstate.json");

let cachedEnabled = null; // null = ainda não carregado

function load() {
  if (cachedEnabled !== null) return cachedEnabled;
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      cachedEnabled = data.enabled !== false; // qualquer coisa que não seja explicitamente false = ligado
    } else {
      cachedEnabled = true; // sem ficheiro = estado por omissão: ligado
    }
  } catch (err) {
    console.error("[botstate] erro ao ler estado, assumindo ligado:", err.message);
    cachedEnabled = true;
  }
  return cachedEnabled;
}

export function isBotEnabled() {
  return load();
}

export function setBotEnabled(value) {
  cachedEnabled = !!value;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify({ enabled: cachedEnabled, updatedAt: Date.now() }, null, 2));
  } catch (err) {
    console.error("[botstate] erro ao gravar estado:", err.message);
  }
}
