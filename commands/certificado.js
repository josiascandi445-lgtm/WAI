/**
 * commands/certificado.js
 *
 * Gera um "certificado" em imagem (SVG → PNG via sharp), com foto de
 * perfil quando disponível. Sem APIs externas.
 *
 * SOBRE O NOME (em vez do número): o WhatsApp/Baileys só entrega o
 * "pushName" (nome de exibição) de quem ENVIA a mensagem — não existe
 * forma de obter o nome de outra pessoa só a partir do JID, a não ser
 * que o bot mantenha uma base de contactos própria (este projecto não
 * tem uma, de propósito, para não guardar dados de terceiros). Por isso:
 *   - Se fizeres ".certificado <categoria>" sem mencionar ninguém →
 *     usa o TEU pushName real (o WhatsApp entrega-o automaticamente).
 *   - Se mencionares alguém (@user) → escreve o nome logo a seguir à
 *     menção, ex: ".certificado cds @244911111111 Ana Paula". Sem nome
 *     escrito, mostra "+244911111111" (formatado, não o número "cru"
 *     colado que aparecia antes) em vez de um número estranho.
 *
 * Uso:
 *   .certificado                          → categoria default, para ti
 *   .certificado <categoria>              → categoria, para ti
 *   .certificado <categoria> @user [Nome] → categoria, para @user
 *   .certificado <motivo livre>           → (compatível com o antigo uso)
 *
 * Categorias: cds, win, ghost, burla, vip, cday, top3, top2, top1
 * (qualquer coisa fora desta lista cai no "default").
 */
import sharp from "sharp";

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function wrapText(text, maxCharsPerLine = 42) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length > maxCharsPerLine) {
      if (current) lines.push(current.trim());
      current = w;
    } else {
      current = (current + " " + w).trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines.slice(0, 3);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Formata um JID em algo apresentável quando não há nome disponível.
 * @lid não é um número de telefone real (é um ID interno do WhatsApp) —
 * mostrar esses dígitos é o que ficava "estranho"; por isso, nesse caso
 * mostramos "Membro" em vez de um número que nem é válido.
 */
function formatPhoneDigits(jid) {
  const digits = jid.split("@")[0].replace(/[^0-9]/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

/**
 * Formata um JID em algo apresentável quando não há nome disponível.
 *
 * @lid não é directamente um número de telefone (é um ID interno do
 * WhatsApp) — mas o Baileys guarda internamente um mapeamento @lid →
 * número real (sock.signalRepository.lidMapping), preenchido depois de
 * o bot já ter visto uma mensagem "normal" dessa pessoa. Tentamos usá-lo
 * primeiro; se não conseguirmos resolver (mapeamento ainda vazio, ou
 * versão do Baileys sem esta API), caímos para "Membro" em vez de
 * mostrar um número que nem é real.
 */
export async function fallbackDisplayName(sock, jid) {
  if (!jid) return "Membro";

  if (!jid.endsWith("@lid")) {
    return formatPhoneDigits(jid) || "Membro";
  }

  try {
    const pn = await sock?.signalRepository?.lidMapping?.getPNForLID?.(jid);
    if (pn) {
      const formatted = formatPhoneDigits(pn);
      if (formatted) return formatted;
    }
  } catch (err) {
    console.warn(`[certificado] não consegui resolver @lid → número real: ${err.message}`);
  }

  return "Membro"; // mapeamento indisponível — fallback honesto, como antes
}

/**
 * Modelos de certificado. Cada categoria tem um título, subtítulo, emoji
 * e uma lista de elogios — um é escolhido aleatoriamente a cada emissão
 * (mesmo padrão de lib/farewellMessages.js). `theme` controla as cores.
 */
const THEMES = {
  gold:   { bg: ["#1a1a2e", "#16213e"], accent: ["#FFD700", "#FFF3B0", "#FFD700"], text: "#DDDDDD" },
  vip:    { bg: ["#000000", "#1a1a1a"], accent: ["#FFD700", "#FFFFFF", "#FFD700"], text: "#EEEEEE" },
  ghost:  { bg: ["#20242c", "#2c313c"], accent: ["#9AA5B1", "#E4E9F0", "#9AA5B1"], text: "#C7CDD6" },
  danger: { bg: ["#2a1414", "#3a1a1a"], accent: ["#FF6B6B", "#FFD37A", "#FF6B6B"], text: "#EED6D6" },
};

const CATEGORIES = {
  default: {
    title: "CERTIFICADO", subtitle: "TOJI AI — EDIÇÃO ESPECIAL", emoji: "🏆", theme: "gold",
    compliments: ["ser simplesmente incrível"],
  },
  cds: {
    title: "CLIENTE DA SEMANA", subtitle: "RECONHECIMENTO ESPECIAL", emoji: "🌟", theme: "gold",
    compliments: [
      "dedicação e lealdade que fazem toda a diferença",
      "ser a razão pela qual continuamos a melhorar todos os dias",
      "apoiar sempre, com um sorriso e boa energia",
    ],
  },
  win: {
    title: "VENCEDOR DO TORNEIO", subtitle: "CAMPEÃO OFICIAL", emoji: "🏅", theme: "gold",
    compliments: [
      "talento, garra e um toque de sorte para conquistar o topo",
      "não desistir até erguer o troféu",
      "mostrar do que é feito um verdadeiro campeão",
    ],
  },
  ghost: {
    title: "CERTIFICADO DE PRESENÇA FANTASMA", subtitle: "PARABÉNS PELA DISCRIÇÃO", emoji: "👻", theme: "ghost",
    compliments: [
      "nunca reagir, nunca comentar, nunca fazer nada — mas estar sempre presente",
      "elevar a arte de ler e não responder a um novo nível",
      "ser oficialmente o membro mais silencioso (e mais fiel) do grupo",
    ],
  },
  burla: {
    title: "MAIOR BURLADOR DO GRUPO", subtitle: "TÍTULO NADA HONROSO", emoji: "🕵️", theme: "danger",
    compliments: [
      "convencer meio grupo com uma história que nem ele acreditava",
      "ser tão bom a enganar que já quase é profissão",
      "elevar a arte da burla a um nível lendário",
    ],
  },
  vip: {
    title: "CLIENTE VIP", subtitle: "ACESSO TOTAL · EDIÇÃO PREMIUM", emoji: "💎", theme: "vip",
    compliments: [
      "exigência, bom gosto e fidelidade de outro nível",
      "fazer parte do clube mais exclusivo da loja",
      "ser tratado como realeza, porque é isso que merece",
    ],
  },
  cday: {
    title: "CLIENTE DO DIA", subtitle: "DESTAQUE DE HOJE", emoji: "☀️", theme: "gold",
    compliments: [
      "fazer o nosso dia melhor com a sua presença",
      "ser o destaque de hoje por muito boas razões",
      "trazer boa energia logo pela manhã",
    ],
  },
  top3: {
    title: "3º LUGAR — MELHOR CLIENTE DA LOJA", subtitle: "PÓDIO OFICIAL", emoji: "🥉", theme: "gold",
    compliments: ["dedicação que garantiu um lugar no pódio", "consistência que não passou despercebida"],
  },
  top2: {
    title: "2º LUGAR — MELHOR CLIENTE DA LOJA", subtitle: "PÓDIO OFICIAL", emoji: "🥈", theme: "gold",
    compliments: ["estar quase lá — só faltou um pouco mais", "uma prata muito bem merecida"],
  },
  top1: {
    title: "1º LUGAR — MELHOR CLIENTE DA LOJA", subtitle: "PÓDIO OFICIAL", emoji: "🥇", theme: "vip",
    compliments: ["ser, sem dúvida, o número 1", "liderar o pódio com muito mérito"],
  },
};

/**
 * Constrói o SVG do certificado (sem a foto — a foto é composta por
 * cima depois, via sharp, para poder ficar circular). Função pura.
 */
export function buildCertificateSVG({ category, name, reason, dateStr, hasPhoto }) {
  const cat = CATEGORIES[category] || CATEGORIES.default;
  const theme = THEMES[cat.theme] || THEMES.gold;

  const W = 1200, H = 950;
  const safeName = escapeXml(name);
  const reasonLines = wrapText(reason).map(escapeXml);
  const safeDate = escapeXml(dateStr);

  const reasonTSpans = reasonLines
    .map((line, i) => `<tspan x="${W / 2}" dy="${i === 0 ? 0 : 42}">${line}</tspan>`)
    .join("");

  // Espaço reservado para a foto (círculo) — desenhado sempre, mesmo sem
  // foto real, para o layout ficar consistente; a foto real é composta
  // por cima disto depois, exactamente no mesmo sítio.
  const photoCx = W / 2, photoCy = 300, photoR = 110;
  const photoPlaceholder = hasPhoto ? "" : `
    <circle cx="${photoCx}" cy="${photoCy}" r="${photoR}" fill="#00000033"/>
    <text x="${photoCx}" y="${photoCy + 15}" font-family="Arial" font-size="70" text-anchor="middle">${cat.emoji}</text>`;

  return `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${theme.bg[0]}"/>
      <stop offset="100%" stop-color="${theme.bg[1]}"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${theme.accent[0]}"/>
      <stop offset="50%" stop-color="${theme.accent[1]}"/>
      <stop offset="100%" stop-color="${theme.accent[2]}"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="30" y="30" width="${W - 60}" height="${H - 60}" fill="none" stroke="url(#accent)" stroke-width="6"/>
  <rect x="50" y="50" width="${W - 100}" height="${H - 100}" fill="none" stroke="${theme.accent[0]}" stroke-width="1.5" opacity="0.5"/>

  <text x="${W / 2}" y="110" font-family="Georgia, serif" font-size="30" fill="${theme.accent[0]}"
        text-anchor="middle" letter-spacing="6">${cat.emoji} ${escapeXml(cat.title)}</text>
  <text x="${W / 2}" y="152" font-family="Arial, sans-serif" font-size="18" fill="#AAAAAA"
        text-anchor="middle" letter-spacing="3">${escapeXml(cat.subtitle)}</text>

  <circle cx="${photoCx}" cy="${photoCy}" r="${photoR + 8}" fill="none" stroke="url(#accent)" stroke-width="4"/>
  ${photoPlaceholder}

  <text x="${W / 2}" y="450" font-family="Arial, sans-serif" font-size="22" fill="${theme.text}" text-anchor="middle">
    Este certificado é orgulhosamente atribuído a
  </text>

  <text x="${W / 2}" y="525" font-family="Georgia, serif" font-size="52" font-weight="bold" fill="url(#accent)"
        text-anchor="middle">${safeName}</text>

  <line x1="${W / 2 - 220}" y1="555" x2="${W / 2 + 220}" y2="555" stroke="${theme.accent[0]}" stroke-width="2" opacity="0.6"/>

  <text x="${W / 2}" y="610" font-family="Arial, sans-serif" font-size="22" fill="${theme.text}" text-anchor="middle">pelo feito de:</text>
  <text x="${W / 2}" y="665" font-family="Georgia, serif" font-size="28" font-style="italic" fill="#FFFFFF"
        text-anchor="middle">${reasonTSpans}</text>

  <text x="${W / 2}" y="${H - 70}" font-family="Arial, sans-serif" font-size="16" fill="#888888" text-anchor="middle">
    Emitido em ${safeDate} · assinado digitalmente por Toji 🗿
  </text>
</svg>`.trim();
}

async function fetchCircularAvatar(sock, jid, size = 220, grayscale = false) {
  try {
    const url = await sock.profilePictureUrl(jid, "image");
    if (!url) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());

    let img = sharp(buf).resize(size, size, { fit: "cover" });
    if (grayscale) img = img.grayscale();
    const squared = await img.png().toBuffer();

    const mask = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);
    return await sharp(squared).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  } catch {
    return null;
  }
}

export default {
  name: "certificado",
  aliases: ["certificate"],
  description: "Gera um certificado (.certificado [categoria] [@user] [nome])",

  async execute({ sock, jid, msg, args, sender }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
    const isSelf = mentioned.length === 0;
    const targetJid = mentioned[0] ?? sender;

    // 1º arg é categoria válida? Se sim, consome-o; senão fica tudo como texto livre (motivo/nome).
    const firstArg = (args[0] || "").toLowerCase();
    const hasCategory = Object.prototype.hasOwnProperty.call(CATEGORIES, firstArg);
    const category = hasCategory ? firstArg : "default";
    const rest = (hasCategory ? args.slice(1) : args).filter(a => !a.startsWith("@"));
    const freeText = rest.join(" ").trim();

    // Nome: se for para o próprio, usa o pushName real do WhatsApp.
    // Se for para alguém mencionado, usa o texto escrito a seguir à
    // menção; sem isso, mostra o número formatado (não o JID cru).
    let name;
    if (isSelf) {
      name = msg.pushName || await fallbackDisplayName(sock, sender);
    } else {
      name = freeText || await fallbackDisplayName(sock, targetJid);
    }

    const cat = CATEGORIES[category];
    // O "motivo" é sempre um elogio aleatório da categoria — a única
    // excepção é a categoria "default" sem menção, onde o texto livre
    // funciona como motivo personalizado (compatível com o uso antigo).
    const reason = (category === "default" && isSelf && freeText) ? freeText : pick(cat.compliments);

    const dateStr = new Date().toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" });

    try {
      const avatar = await fetchCircularAvatar(sock, targetJid, 220, category === "ghost");

      const svg = buildCertificateSVG({ category, name, reason, dateStr, hasPhoto: !!avatar });
      let png = await sharp(Buffer.from(svg)).png().toBuffer();

      if (avatar) {
        const photoCx = 600, photoCy = 300, photoR = 110;
        png = await sharp(png)
          .composite([{ input: avatar, left: photoCx - photoR, top: photoCy - photoR }])
          .png()
          .toBuffer();
      }

      const captionName = isSelf ? name : `@${targetJid.split("@")[0]}`;
      const messageOpts = { image: png, caption: `${cat.emoji} Certificado emitido para ${captionName}!` };
      if (!isSelf) messageOpts.mentions = [targetJid];

      await sock.sendMessage(jid, messageOpts, { quoted: msg });
    } catch (err) {
      console.error("[certificado] erro:", err.message);
      await sock.sendMessage(jid, { text: "⚠️ Erro ao gerar o certificado." }, { quoted: msg });
    }
  },
};
