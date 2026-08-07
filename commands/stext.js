/**
 * commands/stext.js
 *
 * .stext <palavra1> <palavra2>
 *
 * Gera um sticker com o texto escrito (2 linhas, tipo "ADM OFF"),
 * escolhendo aleatoriamente 1 dos 10 estilos de fonte
 * (lib/stickerStyles.js) e 1 dos 10 fundos (lib/stickerBackgrounds.js)
 * — 100 combinações possíveis no total.
 *
 * O texto é convertido em caminhos SVG a partir do ficheiro .ttf real
 * (lib/stickerFonts.js), não do fontconfig do servidor — por isso os
 * 10 estilos ficam sempre visualmente diferentes entre si, em vez de
 * arriscar cair todos na mesma fonte genérica do sistema.
 */
import sharp from "sharp";
import { STYLES } from "../lib/stickerStyles.js";
import { BACKGROUNDS } from "../lib/stickerBackgrounds.js";
import { loadFont, fitFontSize } from "../lib/stickerFonts.js";

const SIZE = 512;
const MAX_TEXT_WIDTH = 440; // margem de ~36px de cada lado

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Divide as palavras recebidas em 2 linhas (padrão do exemplo "ADM" / "OFF"). */
export function splitIntoTwoLines(words) {
  if (words.length <= 1) return [words.join(" "), ""];
  if (words.length === 2) return [words[0], words[1]];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

/**
 * Constrói o SVG completo (fundo + as 2 linhas de texto como paths reais
 * da fonte escolhida). Função quase-pura — só toca disco para carregar
 * a fonte (lib/stickerFonts.js já tem cache).
 */
export function buildStickerSVG(lines, style, background) {
  const textToSVG = loadFont(style.file);

  const nonEmptyLines = lines.filter(Boolean);
  const lineGap = 16;

  // Calcula o tamanho de letra que cabe na largura, e a altura total,
  // para poder centrar o bloco de texto verticalmente no sticker.
  const sizes = nonEmptyLines.map(line => fitFontSize(textToSVG, line, MAX_TEXT_WIDTH));
  const metricsList = nonEmptyLines.map((line, i) => textToSVG.getMetrics(line, { fontSize: sizes[i] }));
  const totalHeight = metricsList.reduce((sum, m) => sum + (m.height || sizes[0]), 0) + lineGap * (nonEmptyLines.length - 1);

  let y = (SIZE - totalHeight) / 2;
  let textPaths = "";

  nonEmptyLines.forEach((line, i) => {
    const fontSize = sizes[i];
    const metrics = metricsList[i];
    const lineHeight = metrics.height || fontSize;
    const d = textToSVG.getD(line, {
      x: SIZE / 2,
      y: y + lineHeight,
      fontSize,
      anchor: "center baseline",
    });
    textPaths += `<path d="${d}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="${style.strokeWidth}" stroke-linejoin="round" paint-order="stroke"/>\n`;
    y += lineHeight + lineGap;
  });

  return `
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  ${background.render()}
  ${textPaths}
</svg>`.trim();
}

export default {
  name: "stext",
  description: "Cria um sticker com texto estilizado (.stext <palavra1> <palavra2>)",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Uso: .stext <palavra1> <palavra2>\n\nExemplo:\n• .stext ADM OFF\n• .stext BUG SHOP",
      }, { quoted: msg });
    }

    const words = args.map(w => escapeXml(w.toUpperCase()));
    const lines = splitIntoTwoLines(words);

    const style = STYLES[Math.floor(Math.random() * STYLES.length)];
    const background = BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)];

    try {
      const svg = buildStickerSVG(lines, style, background);
      const webp = await sharp(Buffer.from(svg))
        .resize(SIZE, SIZE)
        .webp({ quality: 90 })
        .toBuffer();

      await sock.sendMessage(jid, { sticker: webp }, { quoted: msg });
      console.log(`[stext] ✅ estilo="${style.name}" fundo="${background.name}"`);
    } catch (err) {
      console.error("[stext] erro:", err.message);
      await sock.sendMessage(jid, { text: "⚠️ Erro ao criar o sticker. Tenta um texto mais curto." }, { quoted: msg });
    }
  },
};
