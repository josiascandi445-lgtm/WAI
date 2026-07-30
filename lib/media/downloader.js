/**
 * lib/media/downloader.js
 *
 * Orquestrador central — o coração do sistema.
 * Os comandos (play.js, video.js, dl.js) só chamam este módulo.
 * Ele decide: Cobalt → yt-dlp → erro. Os comandos não sabem qual foi usado.
 *
 * Fluxo:
 *   1. Cobalt tenta descarregar
 *   2. Se falhar → yt-dlp como fallback
 *   3. Se ambos falharem → lança erro com mensagem amigável
 */
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import { cobaltFetch, cobaltDownloadBuffer, cobaltDownloadFile } from "./cobalt.js";
import { ytdlpAudio, ytdlpVideo, ensureTmp }                    from "./ytdlp.js";
import { detectPlatform, isUrl }                                 from "./platformDetector.js";
import { searchYouTube, searchTikTok, searchGeneric }            from "./search.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_DIR   = path.join(__dirname, "../../tmp");

function formatDuration(secs) {
  if (!secs) return "?";
  const h  = Math.floor(secs / 3600);
  const m  = Math.floor((secs % 3600) / 60);
  const s  = secs % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Resolve o URL e metadados a partir de um input (link ou nome).
 * @param {string} input — URL ou texto de pesquisa
 * @param {"audio"|"video"} mode
 * @param {Function} statusFn — callback para enviar mensagens de progresso
 * @returns {Promise<{ url, info }>}
 */
async function resolveInput(input, mode, statusFn) {
  if (isUrl(input)) {
    // Input é um link — detecta plataforma e usa directamente
    const platform = detectPlatform(input) || { name: "Web", emoji: "🌐" };
    await statusFn(`🔎 Detectando plataforma...\n📌 *${platform.emoji} ${platform.name}*`);
    return { url: input, info: { platform: platform.name, title: input } };
  }

  // Input é texto — pesquisa
  await statusFn("🔎 *A procurar...*");

  // Para pesquisa por texto, usa sempre YouTube como fonte primária
  const result = await searchYouTube(input);

  const card =
    `🎬 *Encontrado!*\n\n` +
    `📌 *${result.platform}*\n` +
    `🎵 *Título:* ${result.title}\n` +
    `👤 *Canal:* ${result.uploader}\n` +
    `⏱ *Duração:* ${result.durationFmt}\n` +
    `👁 *Views:* ${result.views}\n\n` +
    (mode === "audio" ? `🎵 *Qualidade:* Áudio MP3` : `📦 *Qualidade:* 480p`);

  await statusFn(card);

  return { url: result.url, info: result };
}

/**
 * Descarrega ÁUDIO com Cobalt → fallback yt-dlp.
 * @returns {Promise<Buffer>}
 */
async function downloadAudioWithFallback(url, statusFn) {
  // Tentativa 1: Cobalt
  try {
    await statusFn("📥 *Preparando download...*\n🌐 Via Cobalt API");
    const cobalt = await cobaltFetch(url, "audio");
    const buffer = await cobaltDownloadBuffer(cobalt.url);
    console.log("[downloader] áudio via Cobalt ✅");
    return buffer;
  } catch (cobaltErr) {
    console.warn(`[downloader] Cobalt falhou (áudio): ${cobaltErr.message}`);
    await statusFn(
      `⚠️ Cobalt indisponível.\n🔄 *Tentando método alternativo...*`
    );
  }

  // Tentativa 2: yt-dlp
  try {
    await statusFn("📥 *A descarregar via yt-dlp...*");
    const buffer = await ytdlpAudio(url);
    console.log("[downloader] áudio via yt-dlp ✅");
    return buffer;
  } catch (ytErr) {
    throw new Error(`Ambos os métodos falharam: ${ytErr.message}`);
  }
}

/**
 * Descarrega VÍDEO com Cobalt → fallback yt-dlp.
 * @returns {Promise<string>} — caminho do ficheiro criado
 */
async function downloadVideoWithFallback(url, statusFn) {
  ensureTmp();
  const filePath = path.join(TMP_DIR, `video_${Date.now()}.mp4`);

  // Tentativa 1: Cobalt
  try {
    await statusFn("📥 *Preparando download...*\n🌐 Via Cobalt API");
    const cobalt = await cobaltFetch(url, "auto", "480");
    await cobaltDownloadFile(cobalt.url, filePath);
    console.log("[downloader] vídeo via Cobalt ✅");
    return filePath;
  } catch (cobaltErr) {
    console.warn(`[downloader] Cobalt falhou (vídeo): ${cobaltErr.message}`);
    await statusFn(
      `⚠️ Cobalt indisponível.\n🔄 *Tentando método alternativo...*`
    );
    // Limpa ficheiro parcial se existir
    if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch {}
  }

  // Tentativa 2: yt-dlp
  try {
    await statusFn("📥 *A descarregar via yt-dlp...*");
    await ytdlpVideo(url, filePath);
    console.log("[downloader] vídeo via yt-dlp ✅");
    return filePath;
  } catch (ytErr) {
    if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch {}
    throw new Error(`Ambos os métodos falharam: ${ytErr.message}`);
  }
}

// ─── API PÚBLICA DO DOWNLOADER ────────────────────────────────────────────────

/**
 * Download de ÁUDIO — chamado pelos comandos .play / .music / .ytmp3
 *
 * @param {{ sock, jid, msg }} ctx  — contexto do comando
 * @param {string}             input — URL ou texto de pesquisa
 * @returns {Promise<void>}
 */
export async function downloadAndSendAudio(ctx, input) {
  const { sock, jid, msg } = ctx;

  // Helper para actualizar o utilizador
  let statusMsg = null;
  const status = async (text) => {
    try {
      if (!statusMsg) {
        statusMsg = await sock.sendMessage(jid, { text }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text, edit: statusMsg.key });
      }
    } catch {
      // Se a edição falhar, envia nova mensagem
      try { statusMsg = await sock.sendMessage(jid, { text }, { quoted: msg }); } catch {}
    }
  };

  let filePath = null;

  try {
    // 1. Resolve input (link ou pesquisa)
    const { url, info } = await resolveInput(input, "audio", status);

    // 2. Verifica duração máxima (12 min)
    if (info.duration && info.duration > 720) {
      return status(`⚠️ Conteúdo demasiado longo (${formatDuration(info.duration)}). Máximo: 12 minutos.`);
    }

    // 3. Download com Cobalt → fallback yt-dlp
    await status("📦 *A baixar...*");
    const buffer = await downloadAudioWithFallback(url, status);

    // 4. Verifica tamanho (limite WhatsApp: 16MB áudio)
    const sizeMB = buffer.length / (1024 * 1024);
    if (sizeMB > 16) {
      return status(`⚠️ Ficheiro demasiado grande (${sizeMB.toFixed(1)}MB). Tenta conteúdo mais curto.`);
    }

    // 5. Envia
    await status("📤 *A enviar...*");
    const fileName = `${(info.title || "audio").replace(/[^\w\s]/gi, "").trim()}.mp3`;
    await sock.sendMessage(jid, {
      audio:    buffer,
      mimetype: "audio/mpeg",
      fileName,
    }, { quoted: msg });

    // Limpa mensagem de status
    try { await sock.sendMessage(jid, { delete: statusMsg?.key }); } catch {}

    console.log(`[downloader] ✅ Áudio enviado: ${fileName}`);

  } catch (err) {
    console.error(`[downloader] ❌ Erro áudio: ${err.message}`);
    await status(`❌ *Não foi possível descarregar.*\n\n${err.message.includes("falharam") ? "Nenhum método disponível funcionou." : err.message}`);
  } finally {
    if (filePath && fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch {}
  }
}

/**
 * Download de VÍDEO — chamado pelos comandos .video / .ytmp4 / .dl
 *
 * @param {{ sock, jid, msg }} ctx
 * @param {string}             input — URL ou texto de pesquisa
 * @returns {Promise<void>}
 */
export async function downloadAndSendVideo(ctx, input) {
  const { sock, jid, msg } = ctx;

  let statusMsg = null;
  const status = async (text) => {
    try {
      if (!statusMsg) {
        statusMsg = await sock.sendMessage(jid, { text }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text, edit: statusMsg.key });
      }
    } catch {
      try { statusMsg = await sock.sendMessage(jid, { text }, { quoted: msg }); } catch {}
    }
  };

  let filePath = null;

  try {
    // 1. Resolve input
    const { url, info } = await resolveInput(input, "video", status);

    // 2. Verifica duração máxima (5 min para vídeo)
    if (info.duration && info.duration > 300) {
      return status(`⚠️ Vídeo demasiado longo (${formatDuration(info.duration)}). Máximo: 5 minutos.`);
    }

    // 3. Download
    await status("📦 *A baixar...*");
    filePath = await downloadVideoWithFallback(url, status);

    if (!fs.existsSync(filePath)) throw new Error("Ficheiro não foi criado após download");

    // 4. Verifica tamanho (limite WhatsApp: 64MB vídeo)
    const sizeMB = fs.statSync(filePath).size / (1024 * 1024);
    if (sizeMB > 64) {
      return status(`⚠️ Vídeo demasiado pesado (${sizeMB.toFixed(1)}MB). Tenta vídeo mais curto.`);
    }

    // 5. Envia
    await status("📤 *A enviar...*");
    await sock.sendMessage(jid, {
      video:    fs.readFileSync(filePath),
      mimetype: "video/mp4",
      caption:  `🎬 ${info.title || "Vídeo"}`,
    }, { quoted: msg });

    try { await sock.sendMessage(jid, { delete: statusMsg?.key }); } catch {}

    console.log(`[downloader] ✅ Vídeo enviado: ${info.title}`);

  } catch (err) {
    console.error(`[downloader] ❌ Erro vídeo: ${err.message}`);
    await status(`❌ *Não foi possível descarregar.*\n\n${err.message.includes("falharam") ? "Nenhum método disponível funcionou." : err.message}`);
  } finally {
    if (filePath && fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch {}
  }
}
