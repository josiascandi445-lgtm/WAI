/**
 * commands/ship.js
 *
 * "Compatibilidade" entre 2 membros do grupo — busca as fotos de perfil
 * (sock.profilePictureUrl), compõe lado a lado com um coração e uma
 * percentagem no meio, via sharp. Sem APIs externas.
 *
 * Uso:
 *   .ship @user1 @user2
 *   .ship @user1              → faz ship entre @user1 e quem enviou o comando
 *
 * A percentagem é determinística por par (hash simples dos 2 números) —
 * o mesmo casal dá sempre a mesma % , como uma "sorte do destino" e não
 * um número diferente a cada vez.
 */
import sharp from "sharp";

/** Hash simples e determinístico → 0-100. Função pura, testável isolada. */
export function shipPercentage(jidA, jidB) {
  const numA = jidA.split("@")[0];
  const numB = jidB.split("@")[0];
  const combined = [numA, numB].sort().join("+"); // ordem não importa: A+B == B+A
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash * 31 + combined.charCodeAt(i)) >>> 0;
  }
  return hash % 101; // 0-100 inclusive
}

function shipEmoji(pct) {
  if (pct >= 90) return "💞 Almas gémeas!";
  if (pct >= 70) return "❤️ Grande combinação!";
  if (pct >= 50) return "💛 Tem potencial...";
  if (pct >= 25) return "💔 Complicado.";
  return "🥶 Melhor ficarem só amigos.";
}

async function fetchAvatarBuffer(sock, jid) {
  try {
    const url = await sock.profilePictureUrl(jid, "image");
    if (!url) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** Placeholder simples (círculo cinzento) quando não há foto de perfil. */
function placeholderAvatarSVG() {
  return `<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="400" fill="#3a3a3a"/>
    <circle cx="200" cy="160" r="80" fill="#666"/>
    <ellipse cx="200" cy="360" rx="140" ry="120" fill="#666"/>
  </svg>`;
}

export default {
  name: "ship",
  description: "Compatibilidade entre 2 membros (.ship @user1 @user2)",

  async execute({ sock, jid, msg, sender }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];

    let jidA, jidB;
    if (mentioned.length >= 2) {
      [jidA, jidB] = mentioned;
    } else if (mentioned.length === 1) {
      jidA = sender;
      jidB = mentioned[0];
    } else {
      return sock.sendMessage(jid, {
        text: "❌ Uso: .ship @user1 @user2\n(ou .ship @user para fazer ship contigo mesmo)",
      }, { quoted: msg });
    }

    if (jidA === jidB) {
      return sock.sendMessage(jid, { text: "🤔 Não dá pra fazer ship de alguém consigo mesmo(a)." }, { quoted: msg });
    }

    try {
      const [bufA, bufB] = await Promise.all([
        fetchAvatarBuffer(sock, jidA),
        fetchAvatarBuffer(sock, jidB),
      ]);

      const placeholder = await sharp(Buffer.from(placeholderAvatarSVG())).png().toBuffer();

      const [imgA, imgB] = await Promise.all([
        sharp(bufA || placeholder).resize(400, 400, { fit: "cover" }).png().toBuffer(),
        sharp(bufB || placeholder).resize(400, 400, { fit: "cover" }).png().toBuffer(),
      ]);

      const pct = shipPercentage(jidA, jidB);
      const label = shipEmoji(pct);

      const W = 900, H = 400;
      const overlaySVG = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#0d0d0d"/>
  <circle cx="${W / 2}" cy="${H / 2}" r="90" fill="#ff2d6f"/>
  <text x="${W / 2}" y="${H / 2 - 5}" font-family="Arial, sans-serif" font-size="42" font-weight="900"
        fill="#FFFFFF" text-anchor="middle">${pct}%</text>
  <text x="${W / 2}" y="${H / 2 + 35}" font-family="Arial, sans-serif" font-size="20"
        fill="#FFFFFF" text-anchor="middle">💘</text>
</svg>`.trim();

      const overlay = await sharp(Buffer.from(overlaySVG)).png().toBuffer();

      const final = await sharp({ create: { width: W, height: H, channels: 4, background: "#0d0d0d" } })
        .composite([
          { input: imgA, left: 0, top: 0 },
          { input: imgB, left: W - 400, top: 0 },
          { input: overlay, left: 0, top: 0 },
        ])
        .png()
        .toBuffer();

      const numA = jidA.split("@")[0], numB = jidB.split("@")[0];
      await sock.sendMessage(jid, {
        image: final,
        caption: `💘 *Ship:* @${numA} + @${numB}\n${pct}% de compatibilidade\n${label}`,
        mentions: [jidA, jidB],
      }, { quoted: msg });
    } catch (err) {
      console.error("[ship] erro:", err.message);
      await sock.sendMessage(jid, { text: "⚠️ Erro ao gerar o ship." }, { quoted: msg });
    }
  },
};
