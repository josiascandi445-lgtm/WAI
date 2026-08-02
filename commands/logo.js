/**
 * commands/logo.js
 *
 * Gera um "logotipo" de texto estilizado (gradiente/neon/glitch) 100%
 * localmente — SVG construído em memória, rasterizado para PNG pelo sharp
 * (já é dependência do projecto, usada em sticker.js/take.js). Sem APIs
 * externas, sem dependências novas.
 *
 * Uso:
 *   .logo <texto>                → estilo "gradient" (default)
 *   .logo neon <texto>           → estilo neon
 *   .logo glitch <texto>         → estilo glitch
 *   .logo fire <texto>           → estilo fogo
 */
import sharp from "sharp";

const STYLES = ["gradient", "neon", "glitch", "fire"];
const MAX_CHARS = 24;

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Escolhe um tamanho de fonte que caiba na largura do canvas consoante o comprimento do texto. */
function fontSizeFor(text) {
  if (text.length <= 8)  return 110;
  if (text.length <= 14) return 78;
  if (text.length <= 18) return 60;
  return 46;
}

/**
 * Constrói o SVG do logo consoante o estilo. Função pura — sem I/O — para
 * ser testável isoladamente sem precisar do sharp.
 * @param {string} text
 * @param {"gradient"|"neon"|"glitch"|"fire"} style
 * @returns {string} SVG
 */
export function buildLogoSVG(text, style = "gradient") {
  const safe = escapeXml(text);
  const fs_  = fontSizeFor(text);
  const W = 1000, H = 400;
  const cx = W / 2, cy = H / 2 + fs_ / 3;

  const defsByStyle = {
    gradient: `
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#8E2DE2"/>
        <stop offset="50%" stop-color="#FF4E50"/>
        <stop offset="100%" stop-color="#F9D423"/>
      </linearGradient>`,
    neon: `
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#00F5FF"/>
        <stop offset="100%" stop-color="#FF00E5"/>
      </linearGradient>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="10" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>`,
    glitch: `
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#FFFFFF"/>
        <stop offset="100%" stop-color="#EAEAEA"/>
      </linearGradient>`,
    fire: `
      <linearGradient id="g" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stop-color="#FF0000"/>
        <stop offset="50%" stop-color="#FF8C00"/>
        <stop offset="100%" stop-color="#FFD700"/>
      </linearGradient>`,
  };

  const bg = `<rect width="${W}" height="${H}" fill="#0d0d0d"/>`;
  const fontFamily = "Arial, Helvetica, sans-serif";

  let extraLayers = "";
  if (style === "glitch") {
    // Duas cópias desalinhadas em ciano/magenta por trás do texto branco = efeito glitch clássico.
    extraLayers = `
      <text x="${cx - 6}" y="${cy}" font-family="${fontFamily}" font-size="${fs_}" font-weight="900"
            text-anchor="middle" fill="#00F5FF" opacity="0.75">${safe}</text>
      <text x="${cx + 6}" y="${cy}" font-family="${fontFamily}" font-size="${fs_}" font-weight="900"
            text-anchor="middle" fill="#FF00E5" opacity="0.75">${safe}</text>`;
  }

  const mainTextFilter = style === "neon" ? ` filter="url(#glow)"` : "";

  return `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>${defsByStyle[style] || defsByStyle.gradient}</defs>
  ${bg}
  ${extraLayers}
  <text x="${cx}" y="${cy}" font-family="${fontFamily}" font-size="${fs_}" font-weight="900"
        text-anchor="middle" fill="url(#g)"${mainTextFilter}>${safe}</text>
</svg>`.trim();
}

export default {
  name: "logo",
  description: "Gera um logotipo de texto estilizado (.logo [neon|glitch|fire] <texto>)",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text:
          "❌ Uso: .logo <texto>\n\n" +
          "Estilos: .logo neon <texto> | .logo glitch <texto> | .logo fire <texto>\n" +
          "Exemplo: .logo neon Toji AI",
      }, { quoted: msg });
    }

    let style = "gradient";
    let words = args;
    if (STYLES.includes(args[0].toLowerCase())) {
      style = args[0].toLowerCase();
      words = args.slice(1);
    }

    const text = words.join(" ").trim();
    if (!text) {
      return sock.sendMessage(jid, { text: "❌ Escreve o texto do logo depois do estilo." }, { quoted: msg });
    }
    if (text.length > MAX_CHARS) {
      return sock.sendMessage(jid, { text: `❌ Máximo ${MAX_CHARS} caracteres para o logo caber bem.` }, { quoted: msg });
    }

    try {
      const svg = buildLogoSVG(text, style);
      const png = await sharp(Buffer.from(svg)).png().toBuffer();
      await sock.sendMessage(jid, { image: png, caption: `🎨 *${text}* — estilo: ${style}` }, { quoted: msg });
    } catch (err) {
      console.error("[logo] erro:", err.message);
      await sock.sendMessage(jid, { text: "⚠️ Erro ao gerar o logo. Tenta um texto mais curto." }, { quoted: msg });
    }
  },
};
