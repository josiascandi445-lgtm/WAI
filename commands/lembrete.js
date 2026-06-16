/**
 * Comando: .lembrete
 * Define um lembrete que o bot envia depois de X tempo.
 * Uso: .lembrete 10min Beber água
 *      .lembrete 2h Reunião importante
 */
const LIMITE_POR_USER = 10;
const lembretes = new Map(); // sender → array de timers

function parseTempo(str) {
  const m = str.match(/^(\d+)(s|seg|min|h|hora|horas)$/i);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const mult = unit === "s" || unit === "seg" ? 1000
             : unit === "min"                 ? 60_000
             :                                  3_600_000;
  return n * mult;
}

function fmt(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  return `${Math.floor(m / 60)}h`;
}

export default {
  name: "lembrete",
  aliases: ["lembra", "remind"],
  description: "Define um lembrete (.lembrete 10min Beber água)",

  async execute({ sock, jid, msg, sender, args }) {
    if (args.length < 2) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .lembrete <tempo> <mensagem>\nEx: .lembrete 10min Beber água\nEx: .lembrete 2h Reunião"
      }, { quoted: msg });
    }

    const tempoMs = parseTempo(args[0]);
    if (!tempoMs || tempoMs < 5000) {
      return sock.sendMessage(jid, {
        text: "❌ Tempo inválido. Exemplos: 30s, 10min, 2h\nMínimo: 5 segundos."
      }, { quoted: msg });
    }

    if (tempoMs > 86_400_000) {
      return sock.sendMessage(jid, { text: "❌ Máximo de 24 horas." }, { quoted: msg });
    }

    const lista = lembretes.get(sender) || [];
    if (lista.length >= LIMITE_POR_USER) {
      return sock.sendMessage(jid, {
        text: `⚠️ Já tens ${LIMITE_POR_USER} lembretes activos.`
      }, { quoted: msg });
    }

    const texto = args.slice(1).join(" ");

    await sock.sendMessage(jid, {
      text: `⏰ *Lembrete definido!*\n📝 ${texto}\n⏱️ Em ${fmt(tempoMs)}`
    }, { quoted: msg });

    const timerId = setTimeout(async () => {
      try {
        await sock.sendMessage(jid, {
          text: `🔔 *LEMBRETE*\n\n📝 ${texto}`
        });
      } catch (err) {
        console.error("[lembrete] erro ao enviar:", err.message);
      } finally {
        const l = lembretes.get(sender) || [];
        lembretes.set(sender, l.filter(t => t !== timerId));
      }
    }, tempoMs);

    lembretes.set(sender, [...lista, timerId]);
  }
};
