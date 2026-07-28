/**
 * commands/time.js
 * Cronómetro com edição contínua da mesma mensagem.
 *
 * ─── COMO FUNCIONA A EDIÇÃO ───────────────────────────────────────────────────
 * 1. O bot envia a mensagem inicial e guarda o msg.key retornado.
 * 2. Cada tick do setInterval chama sock.sendMessage com { edit: savedKey, text: novoTexto }.
 * 3. O Baileys envia um EditedMessage — o WhatsApp substitui o conteúdo
 *    no lugar, sem criar uma nova mensagem.
 * 4. Ao terminar, a mensagem final é também enviada como edição.
 *
 * ─── COMO FUNCIONA O CRONÓMETRO PRECISO ──────────────────────────────────────
 * Não decrementa uma variável a cada tick (acumula erro se a edição atrasar).
 * Guarda endTime = Date.now() + totalSecs * 1000 no início.
 * Cada tick calcula: remaining = Math.ceil((endTime - Date.now()) / 1000)
 * Assim o cronómetro fica sempre sincronizado com o relógio real.
 *
 * ─── ORGANIZAÇÃO DOS LAYOUTS ──────────────────────────────────────────────────
 * Todos os layouts estão no Map LAYOUTS no topo do ficheiro.
 * A lógica do cronómetro é cega aos layouts — recebe um objecto.
 * Para adicionar um novo layout: só acrescentar uma entrada no Map.
 * O campo "corpo" suporta o placeholder {time} — substituído pelo tempo actual.
 *
 * ─── SIMULTANEIDADE ───────────────────────────────────────────────────────────
 * Usa setInterval (não while+sleep) — liberta o event loop entre ticks.
 * Vários cronómetros em grupos e chats diferentes correm em paralelo.
 */

// ─── LAYOUTS PRÉ-DEFINIDOS ────────────────────────────────────────────────────
// Para adicionar um novo layout: acrescentar uma entrada neste Map.
// Campos:
//   icone       → emoji do título durante a contagem
//   titulo      → texto do título durante a contagem
//   labelTempo  → linha acima do cronómetro ("Tempo restante" / "Tempo estimado")
//   corpo       → texto abaixo da barra. Suporta {time} → substituído pelo tempo actual.
//   iconeFim    → emoji do título final
//   tituloFim   → texto do título final
//   corpoFim    → mensagem quando o tempo acaba
const LAYOUTS = new Map([
  ["pagamento", {
    icone:      "💳",
    titulo:     "PAGAMENTO",
    labelTempo: "⏳ Tempo restante",
    corpo:      "⚠️ Efetue o pagamento antes que o tempo termine.",
    iconeFim:   "❌",
    tituloFim:  "TEMPO EXPIRADO",
    corpoFim:   "Seu tempo para pagamento terminou.\n\nCaso ainda queira concluir o pedido,\nfaça uma nova solicitação.",
  }],
  ["entrega", {
    icone:      "📦",
    titulo:     "ENTREGA",
    labelTempo: "⏳ Tempo estimado",
    corpo:      "🚚 A entrega será realizada dentro do tempo estimado.",
    iconeFim:   "✅",
    tituloFim:  "ENTREGA",
    corpoFim:   "O tempo estimado foi concluído.\n\nEsperamos que sua entrega já tenha sido realizada.",
  }],
  ["sorteio", {
    icone:      "🎉",
    titulo:     "SORTEIO",
    labelTempo: "⏳ Tempo restante",
    corpo:      "🎁 O sorteio terminará no tempo definido.\nAproveite enquanto ainda dá tempo!",
    iconeFim:   "🎉",
    tituloFim:  "SORTEIO ENCERRADO",
    corpoFim:   "O sorteio foi encerrado.\n\nBoa sorte aos participantes!",
  }],
  ["promoção", {
    icone:      "🔥",
    titulo:     "PROMOÇÃO",
    labelTempo: "⏳ Tempo restante",
    corpo:      "💸 A promoção terminará em breve.\nGaranta sua oferta antes que expire.",
    iconeFim:   "⌛",
    tituloFim:  "PROMOÇÃO ENCERRADA",
    corpoFim:   "A promoção chegou ao fim.\n\nFique atento às próximas ofertas.",
  }],
  ["promocao", {  // alias sem acento
    icone:      "🔥",
    titulo:     "PROMOÇÃO",
    labelTempo: "⏳ Tempo restante",
    corpo:      "💸 A promoção terminará em breve.\nGaranta sua oferta antes que expire.",
    iconeFim:   "⌛",
    tituloFim:  "PROMOÇÃO ENCERRADA",
    corpoFim:   "A promoção chegou ao fim.\n\nFique atento às próximas ofertas.",
  }],
  ["suporte", {
    icone:      "🛠️",
    titulo:     "SUPORTE",
    labelTempo: "⏳ Tempo estimado",
    corpo:      "💬 Aguarde.\nNossa equipe responderá dentro do tempo estimado.",
    iconeFim:   "✅",
    tituloFim:  "SUPORTE",
    corpoFim:   "O tempo estimado terminou.\n\nCaso ainda não tenha recebido resposta,\nentre em contato novamente.",
  }],
  ["manutenção", {
    icone:      "🔧",
    titulo:     "MANUTENÇÃO",
    labelTempo: "⏳ Tempo restante",
    corpo:      "⚙️ O sistema está em manutenção.\nAlguns recursos podem ficar indisponíveis.",
    iconeFim:   "✅",
    tituloFim:  "MANUTENÇÃO FINALIZADA",
    corpoFim:   "A manutenção foi concluída.\n\nOs serviços já podem ser utilizados normalmente.",
  }],
  ["manutencao", {  // alias sem acento
    icone:      "🔧",
    titulo:     "MANUTENÇÃO",
    labelTempo: "⏳ Tempo restante",
    corpo:      "⚙️ O sistema está em manutenção.\nAlguns recursos podem ficar indisponíveis.",
    iconeFim:   "✅",
    tituloFim:  "MANUTENÇÃO FINALIZADA",
    corpoFim:   "A manutenção foi concluída.\n\nOs serviços já podem ser utilizados normalmente.",
  }],

  // ── NOVO LAYOUT: AUSÊNCIA ─────────────────────────────────────────────────
  // O campo "corpo" usa {time} — substituído pelo tempo actual a cada tick.
  // Para alterar a frase: edita apenas a linha "corpo:" abaixo.
  // Para alterar a mensagem final: edita apenas a linha "corpoFim:" abaixo.
  ["ausencia", {
    icone:      "🕐",
    titulo:     "AUSÊNCIA",
    labelTempo: "⏳ Tempo restante",
    corpo:      "💬 Estarei ausente, volto daqui a {time}.",
    iconeFim:   "🟢",
    tituloFim:  "ESTOU DE VOLTA",
    corpoFim:   "Já estou de volta!\n\nObrigado pela compreensão.",
  }],
  ["ausência", {  // alias com acento
    icone:      "🕐",
    titulo:     "AUSÊNCIA",
    labelTempo: "⏳ Tempo restante",
    corpo:      "💬 Estarei ausente, volto daqui a {time}.",
    iconeFim:   "🟢",
    tituloFim:  "ESTOU DE VOLTA",
    corpoFim:   "Já estou de volta!\n\nObrigado pela compreensão.",
  }],
]);

// ─── CRONÓMETROS ACTIVOS ──────────────────────────────────────────────────────
const activeTimers = new Map();
let timerCounter = 0;

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────

/** "3m" → 180 | "30s" → 30 | "1h" → 3600 | inválido → null */
function parseDuration(str) {
  const m = str.match(/^(\d+)(s|m|h)$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const u = m[2].toLowerCase();
  return u === "s" ? n : u === "m" ? n * 60 : n * 3600;
}

/** Converte segundos para MM:SS ou HH:MM:SS */
function formatTime(secs) {
  const s = Math.max(0, secs);
  const h  = Math.floor(s / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const mm = String(m).padStart(2, "0");
  const sStr = String(ss).padStart(2, "0");
  return h > 0 ? `${String(h).padStart(2, "0")}:${mm}:${sStr}` : `${mm}:${sStr}`;
}

/** Barra de 10 blocos com percentagem */
function progressBar(remaining, total) {
  const ratio   = Math.max(0, Math.min(1, remaining / total));
  const filled  = Math.round(ratio * 10);
  const bar     = "█".repeat(filled) + "░".repeat(10 - filled);
  const percent = Math.round(ratio * 100);
  return `${bar} ${percent}%`;
}

// ─── CONSTRUTORES DE TEXTO ────────────────────────────────────────────────────

/**
 * Modo 1 — texto durante a contagem com layout pré-definido.
 * O emoji ⏳/⌛ alterna a cada segundo.
 * {time} no campo "corpo" é substituído pelo tempo actual.
 */
function buildLayoutText(layout, remaining, total, tick) {
  const hg   = tick % 2 === 0 ? "⏳" : "⌛";
  const bar  = progressBar(remaining, total);
  const time = formatTime(remaining);

  // Substitui {time} no corpo (usado pelo layout "ausencia" e futuros)
  const corpoResolvido = layout.corpo.replace(/\{time\}/gi, time);

  return [
    `╭━━━〔 ${layout.icone} ${layout.titulo} 〕━━━╮`,
    ``,
    `${hg} ${layout.labelTempo.replace(/^[⏳⌛]\s*/, "")}`,
    ``,
    `*${time}*`,
    ``,
    `${bar}`,
    ``,
    `${corpoResolvido}`,
    ``,
    `╰━━━━━━━━━━━━━━━━━━━━━━╯`,
  ].join("\n");
}

/** Modo 1 — texto final */
function buildLayoutEndText(layout) {
  return [
    `╭━━━〔 ${layout.iconeFim} ${layout.tituloFim} 〕━━━╮`,
    ``,
    `${layout.corpoFim}`,
    ``,
    `╰━━━━━━━━━━━━━━━━━━━━━━╯`,
  ].join("\n");
}

/**
 * Modo 2 — substitui todos os "time" (com aspas) pelo tempo actual.
 * Também alterna ⏳/⌛ se o template contiver {hg}.
 */
function buildCustomText(template, remaining, tick) {
  const time = formatTime(remaining);
  const hg   = tick % 2 === 0 ? "⏳" : "⌛";
  return template
    .replace(/"time"/gi, time)
    .replace(/\{hg\}/gi, hg);
}

// ─── MOTOR DO CRONÓMETRO ──────────────────────────────────────────────────────

async function runTimer(sock, jid, quotedMsg, totalSecs, layout, template) {
  // ALTERAÇÃO 1: intervalo de 1000ms (era 2000ms)
  const INTERVAL = 1000;
  const id       = ++timerCounter;

  // ALTERAÇÃO 2: timestamp do fim para cálculo preciso
  // Em vez de decrementar uma variável (acumula erro se a edição atrasar),
  // calculamos sempre: remaining = Math.ceil((endTime - Date.now()) / 1000)
  const endTime  = Date.now() + totalSecs * 1000;
  let tick       = 0;
  let sentKey    = null;

  // Texto inicial (remaining = totalSecs, tick = 0)
  const textoInicial = layout
    ? buildLayoutText(layout, totalSecs, totalSecs, tick)
    : buildCustomText(template, totalSecs, tick);

  try {
    const sent = await sock.sendMessage(jid, { text: textoInicial }, { quoted: quotedMsg });
    sentKey = sent?.key;
    if (!sentKey) throw new Error("key da mensagem não retornado pelo Baileys");
  } catch (err) {
    console.error(`[time] #${id} falhou ao enviar mensagem inicial: ${err.message}`);
    return;
  }

  console.log(`[time] #${id} iniciado — ${totalSecs}s | jid=${jid}`);

  const intervalId = setInterval(async () => {
    tick++;

    // ALTERAÇÃO 2 (continuação): tempo real restante baseado em timestamp
    const remaining = Math.ceil((endTime - Date.now()) / 1000);

    // ── Tempo esgotado ────────────────────────────────────────────
    if (remaining <= 0) {
      clearInterval(intervalId);
      activeTimers.delete(id);

      const textoFim = layout
        ? buildLayoutEndText(layout)
        : buildCustomText(template, 0, tick);

      try {
        await sock.sendMessage(jid, { text: textoFim, edit: sentKey });
        console.log(`[time] #${id} concluído`);
      } catch (err) {
        console.error(`[time] #${id} erro na mensagem final: ${err.message}`);
      }
      return;
    }

    // ── Ainda em contagem — edita a mensagem existente ────────────
    const textoActual = layout
      ? buildLayoutText(layout, remaining, totalSecs, tick)
      : buildCustomText(template, remaining, tick);

    try {
      await sock.sendMessage(jid, { text: textoActual, edit: sentKey });
    } catch (err) {
      console.error(`[time] #${id} erro ao editar: ${err.message}`);
      clearInterval(intervalId);
      activeTimers.delete(id);
    }
  }, INTERVAL);

  activeTimers.set(id, intervalId);
}

// ─── EXPORTAÇÃO DO COMANDO ────────────────────────────────────────────────────
export default {
  name: "time",
  aliases: ["timer", "cronometro"],
  description: "Cronómetro com edição contínua (.time 5m sorteio / .time 3m Paga em \"time\")",

  async execute({ sock, msg, jid, args, prefix }) {
    if (args.length < 2) {
      return sock.sendMessage(jid, {
        text:
          `❌ *Uso incorrecto.*\n\n` +
          `*Modo 1 — layout:*\n${prefix}time 3m pagamento\n${prefix}time 10m sorteio\n${prefix}time 3m ausencia\n\n` +
          `*Modo 2 — personalizado:*\n${prefix}time 5m Me paga em "time"\n${prefix}time 1h Restam "time" para o evento\n\n` +
          `*Layouts:* pagamento · entrega · sorteio · promoção · suporte · manutenção · ausencia\n` +
          `*Unidades:* 30s · 5m · 2h`,
      }, { quoted: msg });
    }

    const totalSecs = parseDuration(args[0]);
    if (!totalSecs || totalSecs < 5) {
      return sock.sendMessage(jid, {
        text: "❌ Duração inválida. Exemplos: *30s*, *5m*, *1h*\nMínimo: 5 segundos.",
      }, { quoted: msg });
    }
    if (totalSecs > 7200) {
      return sock.sendMessage(jid, {
        text: "❌ Duração máxima: *2 horas*.",
      }, { quoted: msg });
    }

    const resto         = args.slice(1).join(" ").trim();
    const ultimaPalavra = args[args.length - 1].toLowerCase();
    const layout        = LAYOUTS.get(ultimaPalavra);

    // Modo 1: ".time Xm <layout>"
    if (layout && args.length === 2) {
      console.log(`[time] Modo 1 — layout="${ultimaPalavra}" | ${totalSecs}s`);
      runTimer(sock, jid, msg, totalSecs, layout, null);
      return;
    }

    // Modo 2: texto personalizado com placeholder "time"
    if (resto.includes('"time"')) {
      console.log(`[time] Modo 2 — personalizado | ${totalSecs}s`);
      runTimer(sock, jid, msg, totalSecs, null, resto);
      return;
    }

    // Fallback: último token é layout válido mas com mais texto antes
    if (layout) {
      console.log(`[time] Modo 1 (fallback) — layout="${ultimaPalavra}" | ${totalSecs}s`);
      runTimer(sock, jid, msg, totalSecs, layout, null);
      return;
    }

    await sock.sendMessage(jid, {
      text:
        `❌ Modo não reconhecido.\n\n` +
        `• Layout: *${prefix}time 5m sorteio*\n` +
        `• Personalizado: *${prefix}time 5m Termina em "time"*`,
    }, { quoted: msg });
  },
};
