/**
 * Comando: .old [@utilizador]
 * Mostra há quantos dias um utilizador está no grupo e a sua classificação.
 *
 * LIMITAÇÃO IMPORTANTE (documentada honestamente):
 * A API do WhatsApp (via Baileys) NÃO fornece a data de entrada de um
 * participante no grupo — groupMetadata não inclui esse campo.
 * O que existe é: se o bot registar a primeira vez que vê cada utilizador
 * num grupo, pode calcular os dias desde então. Mas isso só funciona a
 * partir do momento em que o bot foi adicionado ao grupo.
 *
 * Para contagem de mensagens: o bot só conta mensagens enviadas DEPOIS
 * de ser adicionado ao grupo — o WhatsApp não fornece histórico.
 *
 * Ambos os contadores são guardados em data/stats.json e persistem
 * entre restarts graças ao disco persistente do Render.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATS_FILE = path.join(__dirname, "../data/stats.json");
const DATA_DIR   = path.join(__dirname, "../data");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadStats() {
  try {
    if (!fs.existsSync(STATS_FILE)) return {};
    return JSON.parse(fs.readFileSync(STATS_FILE, "utf8"));
  } catch { return {}; }
}

function saveStats(data) {
  try { fs.writeFileSync(STATS_FILE, JSON.stringify(data, null, 2)); } catch {}
}

// Regista a primeira vez que o bot vê este utilizador neste grupo
export function trackUser(groupJid, userJid) {
  const stats = loadStats();
  const key = `${groupJid}:${userJid}`;
  if (!stats[key]) {
    stats[key] = { firstSeen: Date.now(), messages: 0 };
    saveStats(stats);
  } else {
    stats[key].messages = (stats[key].messages || 0) + 1;
    saveStats(stats);
  }
}

function getDaysLabel(days) {
  if (days < 5)   return "🐣 Novato";
  if (days < 10)  return "🌱 Iniciante";
  if (days < 30)  return "🔵 Recente";
  if (days < 50)  return "⚡ Membro";
  if (days < 100) return "🏅 Veterano";
  if (days < 150) return "💎 VIP";
  return "🔥 Lendário";
}

function getMsgLabel(count, total) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  let label;
  if (count === 0)    label = "👻 Ghost";
  else if (pct < 5)   label = "👀 Espectador";
  else if (pct < 15)  label = "😔 Só está pelos sorteios";
  else if (pct < 40)  label = "🎉 Regular";
  else if (pct < 80)  label = "🟢 Membro activo";
  else                label = "🔥 Membro VIP";
  return { pct, label };
}

export default {
  name: "old",
  description: "Mostra há quantos dias um utilizador está no grupo",

  async execute({ sock, jid, msg, sender, args, isGroup }) {
    if (!isGroup) {
      return sock.sendMessage(jid, {
        text: "❌ Este comando só funciona em grupos."
      }, { quoted: msg });
    }

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
    let targetJid = mentioned[0] ?? null;

    if (!targetJid && args.length) {
      const n = args[0].replace(/[^0-9]/g, "");
      if (n) targetJid = `${n}@s.whatsapp.net`;
    }

    if (!targetJid) targetJid = sender;

    const numero = targetJid.split("@")[0];
    const key    = `${jid}:${targetJid}`;
    const stats  = loadStats();
    const entry  = stats[key];

    // Contar total de mensagens de todos os utilizadores deste grupo
    const totalMsgs = Object.entries(stats)
      .filter(([k]) => k.startsWith(`${jid}:`))
      .reduce((sum, [, v]) => sum + (v.messages || 0), 0);

    if (!entry) {
      return sock.sendMessage(jid, {
        text: `📊 *+${numero}*\n\n⚠️ Ainda não tenho dados sobre este utilizador.\nO bot começa a registar utilizadores a partir do momento em que é adicionado ao grupo.`
      }, { quoted: msg });
    }

    const diasNoGrupo = Math.floor((Date.now() - entry.firstSeen) / (1000 * 60 * 60 * 24));
    const dataPrimeira = new Date(entry.firstSeen).toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" });
    const mensagens = entry.messages || 0;
    const { pct, label: msgLabel } = getMsgLabel(mensagens, totalMsgs);
    const diasLabel = getDaysLabel(diasNoGrupo);

    await sock.sendMessage(jid, {
      text:
`📊 *Perfil no grupo*

👤 Número: +${numero}
📅 1ª vez visto: ${dataPrimeira}
⏳ Dias registado: *${diasNoGrupo} dias*
🏷️ Classificação: *${diasLabel}*

━━━━━━━━━━━━━━
💬 Mensagens registadas: *${mensagens}*
📈 Participação: *${pct}%* — ${msgLabel}
━━━━━━━━━━━━━━

⚠️ _Dados registados desde que o bot foi adicionado ao grupo._`
    }, { quoted: msg });
  }
};
