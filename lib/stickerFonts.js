/**
 * lib/stickerFonts.js
 *
 * Carrega as fontes usadas pelo .stext e converte-as em caminhos SVG
 * (via text-to-svg, que lê o .ttf directamente em JS — usa a biblioteca
 * opentype.js por baixo). Isto é DELIBERADAMENTE diferente da técnica
 * usada em lib/logo.js: aqui não dependemos do fontconfig/Pango do
 * servidor "encontrar" a fonte pelo nome — o desenho de cada letra é
 * calculado directamente a partir do ficheiro .ttf, por isso funciona
 * de forma idêntica em qualquer ambiente, com ou sem essa fonte
 * "instalada" no sistema operativo.
 *
 * Cada fonte é carregada uma única vez (cache em memória) — o ficheiro
 * só é lido do disco na primeira utilização de cada estilo.
 *
 * Se um ficheiro de fonte não existir (falha no download durante o
 * build — ver scripts/setup-fonts.sh), cai automaticamente para a
 * fonte por omissão embutida na própria biblioteca text-to-svg, para
 * o comando nunca falhar por causa disso — só fica com esse estilo
 * visualmente menos distinto até o ficheiro ser corrigido.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import TextToSVG from "text-to-svg";

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR  = path.join(__dirname, "../assets/fonts");

const cache = new Map(); // filename -> instância TextToSVG já carregada
let fallbackInstance = null;

function loadFallback() {
  if (!fallbackInstance) {
    fallbackInstance = TextToSVG.loadSync(); // fonte por omissão embutida no pacote
  }
  return fallbackInstance;
}

/**
 * @param {string} filename — ex: "Anton-Regular.ttf"
 * @returns instância TextToSVG (nunca lança excepção — cai para fallback)
 */
export function loadFont(filename) {
  if (cache.has(filename)) return cache.get(filename);

  const fullPath = path.join(FONTS_DIR, filename);
  let instance;
  try {
    if (fs.existsSync(fullPath)) {
      instance = TextToSVG.loadSync(fullPath);
    } else {
      console.warn(`[stickerFonts] ${filename} não encontrado — a usar fonte de fallback.`);
      instance = loadFallback();
    }
  } catch (err) {
    console.warn(`[stickerFonts] erro ao carregar ${filename}: ${err.message} — a usar fallback.`);
    instance = loadFallback();
  }

  cache.set(filename, instance);
  return instance;
}

/**
 * Encontra o maior fontSize (dentro de [minSize, maxSize]) cujo texto,
 * nesta fonte, não ultrapassa maxWidth. Função pura (dado o textToSVG
 * já carregado), fácil de testar sem precisar de ficheiros reais.
 */
export function fitFontSize(textToSVGInstance, text, maxWidth, { minSize = 40, maxSize = 180 } = {}) {
  let size = maxSize;
  while (size > minSize) {
    const metrics = textToSVGInstance.getMetrics(text, { fontSize: size });
    if (metrics.width <= maxWidth) return size;
    size -= 4;
  }
  return minSize;
}
