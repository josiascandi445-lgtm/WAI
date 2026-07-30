/**
 * lib/media/platformDetector.js
 *
 * Detecta automaticamente a plataforma a partir de um URL.
 * Para adicionar uma nova plataforma: adicionar uma entrada em PLATFORMS.
 * O resto do sistema adapta-se automaticamente.
 */

// Cada entrada: { name, emoji, patterns[] }
const PLATFORMS = [
  {
    name:     "YouTube",
    emoji:    "▶️",
    patterns: [/youtube\.com/, /youtu\.be/],
  },
  {
    name:     "TikTok",
    emoji:    "🎵",
    patterns: [/tiktok\.com/, /vm\.tiktok\.com/, /vt\.tiktok\.com/],
  },
  {
    name:     "Instagram",
    emoji:    "📸",
    patterns: [/instagram\.com/],
  },
  {
    name:     "Facebook",
    emoji:    "📘",
    patterns: [/facebook\.com/, /fb\.watch/, /fb\.com/],
  },
  {
    name:     "X (Twitter)",
    emoji:    "🐦",
    patterns: [/twitter\.com/, /x\.com/],
  },
  {
    name:     "Reddit",
    emoji:    "🤖",
    patterns: [/reddit\.com/, /redd\.it/],
  },
];

/**
 * Tenta detectar a plataforma de um URL.
 * @param {string} url
 * @returns {{ name, emoji } | null}
 */
export function detectPlatform(url) {
  try {
    const lower = url.toLowerCase();
    for (const p of PLATFORMS) {
      if (p.patterns.some(rx => rx.test(lower))) {
        return { name: p.name, emoji: p.emoji };
      }
    }
  } catch {}
  return null;
}

/**
 * Verifica se uma string é um URL válido.
 * @param {string} str
 * @returns {boolean}
 */
export function isUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
