/**
 * lib/fatura.js
 *
 * Geração da fatura/recibo em imagem (SVG → PNG via sharp, mesmo padrão
 * já usado em certificado.js/ship.js/stext.js). O logo oficial da loja
 * (assets/logo.png) é composto por cima do SVG renderizado.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH   = path.join(__dirname, "../assets/logo.png");
const DATA_DIR    = path.join(__dirname, "../data");
const COUNTER_FILE = path.join(DATA_DIR, "fatura_counter.json");

// ─── Parsing do comando ───────────────────────────────────────────────

const DATETIME_RE = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2}):(\d{2})$/;

/**
 * Interpreta ".fatura produto, cliente, data hora". Função pura.
 * @returns {{ok:true, produto, cliente, data, hora}|{ok:false}}
 */
export function parseFaturaInput(rawText) {
  const parts = String(rawText || "").split(",").map(s => s.trim()).filter(Boolean);
  if (parts.length !== 3) return { ok: false };

  const [produto, cliente, dataHora] = parts;
  if (!produto || !cliente) return { ok: false };

  const m = dataHora.match(DATETIME_RE);
  if (!m) return { ok: false };

  const [, dd, mm, yyyy, hh, min] = m;
  const day = parseInt(dd, 10), month = parseInt(mm, 10);
  const hour = parseInt(hh, 10), minute = parseInt(min, 10);
  if (day < 1 || day > 31 || month < 1 || month > 12 || hour > 23 || minute > 59) return { ok: false };

  return {
    ok: true,
    produto,
    cliente,
    data: `${dd.padStart(2, "0")}/${mm.padStart(2, "0")}/${yyyy}`,
    hora: `${hh.padStart(2, "0")}:${min}`,
  };
}

// ─── Número único da fatura (persistente, sobrevive a reinícios) ─────

function todayCode() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

/** Gera o próximo número de fatura do dia (FAT-YYYYMMDD-NNN), persistente e atómico. */
export function generateFaturaNumber() {
  let counters = {};
  try {
    if (fs.existsSync(COUNTER_FILE)) counters = JSON.parse(fs.readFileSync(COUNTER_FILE, "utf8"));
  } catch (err) {
    console.error("[fatura] erro ao ler contador, a recomeçar:", err.message);
  }

  const key = todayCode();
  counters[key] = (counters[key] || 0) + 1;

  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${COUNTER_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(counters, null, 2));
    fs.renameSync(tmp, COUNTER_FILE);
  } catch (err) {
    console.error("[fatura] erro ao gravar contador:", err.message);
  }

  return `FAT-${key}-${String(counters[key]).padStart(3, "0")}`;
}

// ─── Construção visual ─────────────────────────────────────────────────

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function wrapText(text, maxCharsPerLine = 34) {
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
  return lines.slice(0, 2); // máx. 2 linhas — não deixa texto sobreposto
}

const W = 900, H = 1300;
const ACCENT = "#7ED957"; // verde do logo
const BG_1 = "#0b0b0b", BG_2 = "#161616";

function fieldBlock(y, label, valueLines) {
  const valueTSpans = valueLines
    .map((line, i) => `<tspan x="90" dy="${i === 0 ? 0 : 40}">${escapeXml(line)}</tspan>`)
    .join("");
  return `
    <text x="90" y="${y}" font-family="Arial, sans-serif" font-size="20" fill="${ACCENT}" letter-spacing="2">${escapeXml(label).toUpperCase()}</text>
    <text x="90" y="${y + 38}" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="#FFFFFF">${valueTSpans}</text>`;
}

/**
 * Constrói o SVG completo da fatura (sem o logo — composto depois via
 * sharp, para poder usar a imagem PNG real em boa qualidade).
 */
export function buildFaturaSVG({ numero, cliente, produto, data, hora }) {
  const produtoLines = wrapText(produto);
  const clienteLines = wrapText(cliente);

  let y = 560;
  const blocks = [];

  blocks.push(fieldBlock(y, "Cliente", clienteLines)); y += 38 + (clienteLines.length - 1) * 40 + 70;
  blocks.push(fieldBlock(y, "Produto / Serviço", produtoLines)); y += 38 + (produtoLines.length - 1) * 40 + 70;
  blocks.push(fieldBlock(y, "Data", [data])); y += 108;
  blocks.push(fieldBlock(y, "Hora", [hora])); y += 108;

  return `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${BG_1}"/>
      <stop offset="100%" stop-color="${BG_2}"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="24" y="24" width="${W - 48}" height="${H - 48}" fill="none" stroke="${ACCENT}" stroke-width="2" opacity="0.5"/>

  <!-- espaço reservado para o logo (composto por cima, ver fatura.js) -->

  <text x="${W / 2}" y="330" font-family="Arial, sans-serif" font-size="48" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="2">BUG SHOP</text>
  <text x="${W / 2}" y="368" font-family="Arial, sans-serif" font-size="20" fill="${ACCENT}" text-anchor="middle" letter-spacing="6">FATURA / RECIBO</text>

  <line x1="90" y1="410" x2="${W - 90}" y2="410" stroke="${ACCENT}" stroke-width="1.5" opacity="0.5"/>

  <text x="90" y="460" font-family="Arial, sans-serif" font-size="20" fill="#AAAAAA">Nº DA FATURA</text>
  <text x="90" y="495" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="${ACCENT}">${escapeXml(numero)}</text>

  <line x1="90" y1="525" x2="${W - 90}" y2="525" stroke="#333333" stroke-width="1"/>

  ${blocks.join("\n")}

  <line x1="90" y1="${y}" x2="${W - 90}" y2="${y}" stroke="${ACCENT}" stroke-width="1.5" opacity="0.5"/>

  <text x="${W / 2}" y="${y + 70}" font-family="Arial, sans-serif" font-size="26" font-style="italic" fill="#FFFFFF" text-anchor="middle">Obrigado pela compra! 💚</text>

  <text x="${W / 2}" y="${H - 40}" font-family="Arial, sans-serif" font-size="14" fill="#666666" text-anchor="middle">Bug Shop · Fatura gerada automaticamente</text>
</svg>`.trim();
}

/**
 * Gera a imagem final da fatura (PNG) com o logo real composto por cima.
 * @returns {Promise<Buffer>}
 */
export async function renderFaturaImage(fields) {
  const svg = buildFaturaSVG(fields);
  let png = await sharp(Buffer.from(svg)).png().toBuffer();

  if (fs.existsSync(LOGO_PATH)) {
    const logoSize = 220;
    const logo = await sharp(LOGO_PATH)
      .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    png = await sharp(png)
      .composite([{ input: logo, left: Math.round((W - logoSize) / 2), top: 60 }])
      .png()
      .toBuffer();
  } else {
    console.warn("[fatura] assets/logo.png não encontrado — a gerar fatura sem logo.");
  }

  return png;
}
