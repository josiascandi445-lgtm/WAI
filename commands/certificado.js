/**
 * commands/certificado.js
 *
 * Gera um "certificado" engraçado em imagem (SVG → PNG via sharp), com o
 * nome/menção de alguém e um motivo. 100% local, sem APIs externas.
 *
 * Uso:
 *   .certificado @user <motivo>
 *   .certificado <motivo>              → usa quem enviou o comando
 *
 * Exemplo:
 *   .certificado @244911111111 melhor dorminhoco do grupo
 */
import sharp from "sharp";

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Quebra o motivo em linhas para caber no certificado. Função pura, testável isolada. */
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
  return lines.slice(0, 3); // máx. 3 linhas
}

/**
 * Constrói o SVG do certificado. Função pura — sem I/O.
 * @param {string} name
 * @param {string} reason
 * @param {string} dateStr
 */
export function buildCertificateSVG(name, reason, dateStr) {
  const W = 1200, H = 800;
  const safeName = escapeXml(name);
  const reasonLines = wrapText(reason).map(escapeXml);
  const safeDate = escapeXml(dateStr);

  const reasonTSpans = reasonLines
    .map((line, i) => `<tspan x="${W / 2}" dy="${i === 0 ? 0 : 46}">${line}</tspan>`)
    .join("");

  return `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="100%" stop-color="#16213e"/>
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FFD700"/>
      <stop offset="50%" stop-color="#FFF3B0"/>
      <stop offset="100%" stop-color="#FFD700"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="30" y="30" width="${W - 60}" height="${H - 60}" fill="none" stroke="url(#gold)" stroke-width="6"/>
  <rect x="50" y="50" width="${W - 100}" height="${H - 100}" fill="none" stroke="#FFD700" stroke-width="1.5" opacity="0.5"/>

  <text x="${W / 2}" y="160" font-family="Georgia, serif" font-size="34" fill="#FFD700"
        text-anchor="middle" letter-spacing="8">CERTIFICADO</text>
  <text x="${W / 2}" y="210" font-family="Arial, sans-serif" font-size="20" fill="#AAAAAA"
        text-anchor="middle" letter-spacing="4">TOJI AI — EDIÇÃO ESPECIAL</text>

  <text x="${W / 2}" y="300" font-family="Arial, sans-serif" font-size="22" fill="#DDDDDD" text-anchor="middle">
    Este certificado é orgulhosamente atribuído a
  </text>

  <text x="${W / 2}" y="380" font-family="Georgia, serif" font-size="56" font-weight="bold" fill="url(#gold)"
        text-anchor="middle">${safeName}</text>

  <line x1="${W / 2 - 220}" y1="410" x2="${W / 2 + 220}" y2="410" stroke="#FFD700" stroke-width="2" opacity="0.6"/>

  <text x="${W / 2}" y="470" font-family="Arial, sans-serif" font-size="24" fill="#DDDDDD" text-anchor="middle">pelo feito de:</text>
  <text x="${W / 2}" y="530" font-family="Georgia, serif" font-size="30" font-style="italic" fill="#FFFFFF"
        text-anchor="middle">${reasonTSpans}</text>

  <text x="${W / 2}" y="${H - 70}" font-family="Arial, sans-serif" font-size="16" fill="#888888" text-anchor="middle">
    Emitido em ${safeDate} · assinado digitalmente por Toji 🗿
  </text>
</svg>`.trim();
}

export default {
  name: "certificado",
  aliases: ["certificate"],
  description: "Gera um certificado engraçado (.certificado @user <motivo>)",

  async execute({ sock, jid, msg, args, sender }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
    const targetJid  = mentioned[0] ?? sender;
    const targetName = targetJid.split("@")[0];

    // Remove a menção em texto (@244...) dos args para sobrar só o motivo
    const reasonWords = args.filter(a => !a.startsWith("@"));
    const reason = reasonWords.join(" ").trim() || "ser simplesmente incrível";

    const dateStr = new Date().toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" });

    try {
      const svg = buildCertificateSVG(targetName, reason, dateStr);
      const png = await sharp(Buffer.from(svg)).png().toBuffer();

      await sock.sendMessage(jid, {
        image: png,
        caption: `🏆 Certificado emitido para @${targetName}!`,
        mentions: [targetJid],
      }, { quoted: msg });
    } catch (err) {
      console.error("[certificado] erro:", err.message);
      await sock.sendMessage(jid, { text: "⚠️ Erro ao gerar o certificado." }, { quoted: msg });
    }
  },
};
