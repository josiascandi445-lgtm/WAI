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

import { cobaltFetch, cobaltDownloadBuffer, cobaltDownloadFile, isCobaltEnabled } from "./cobalt.js";
import { ytdlpAudio, ytdlpVideo, ensureTmp }                    from "./ytdlp.js";
import { detectPlatform, isUrl }                                 from "./platformDetector.js";
import { searchYouTube, searchSoundCloud }                       from "./search.js";
import { searchAudiomack, audiomackStreamBuffer, isAudiomackEnabled } from "./audiomack.js";

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
    await statusFn(`🔎 *Procurando...*\n📌 ${platform.emoji} ${platform.name} detectado`);
    return { url: input, info: { platform: platform.name, title: input } };
  }

  // Input é texto — pesquisa
  await statusFn("🔎 *Procurando...*");

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
 * Resolve ÁUDIO a partir de TEXTO de pesquisa (nunca chamada para links —
 * um link continua a usar resolveInput() + downloadAudioWithFallback(),
 * exactamente como antes, para não quebrar ".play <link>").
 *
 * Ordem: SoundCloud → Audiomack → YouTube. Cada fonte é tentada UMA vez;
 * se falhar (não encontrado, indisponível, erro de stream, etc.), avança
 * para a próxima — nunca insiste na mesma fonte. Logs detalhados no
 * servidor com prefixo [PLAY]; a mensagem ao utilizador mantém-se simples
 * (gerida pelo statusFn, que já mostra 🔎/📥/📦/📤).
 *
 * @param {string} query
 * @param {Function} statusFn
 * @returns {Promise<{ buffer: Buffer, info: object, source: string }>}
 */
async function resolveAudioByText(query, statusFn) {
  await statusFn("🔎 *Procurando...*");

  // ── 1ª fonte: SoundCloud ──────────────────────────────────────────────
  // yt-dlp fala directamente com a API pública oficial da SoundCloud
  // (scsearch) — sem bloqueios anti-bot, sem cookies necessários.
  try {
    console.log(`[PLAY] SoundCloud: a pesquisar "${query}"`);
    const sc = await searchSoundCloud(query);
    console.log(`[PLAY] SoundCloud: encontrado "${sc.title}" — a obter áudio`);
    const buffer = await ytdlpAudio(sc.url);
    console.log(`[PLAY] SoundCloud: sucesso`);
    return { buffer, info: sc, source: "SoundCloud" };
  } catch (err) {
    console.warn(`[PLAY] SoundCloud: falhou — ${err.message}`);
  }

  // ── 2ª fonte: Audiomack (opcional — só se AUDIOMACK_API_KEY/SECRET configurados) ──
  if (isAudiomackEnabled()) {
    try {
      console.log(`[PLAY] Audiomack: a pesquisar "${query}"`);
      const am = await searchAudiomack(query);
      console.log(`[PLAY] Audiomack: encontrado "${am.title}" — a obter stream oficial`);
      const buffer = await audiomackStreamBuffer(am);
      console.log(`[PLAY] Audiomack: sucesso`);
      return { buffer, info: am, source: "Audiomack" };
    } catch (err) {
      console.warn(`[PLAY] Audiomack: falhou — ${err.message}`);
    }
  } else {
    console.log(`[PLAY] Audiomack: ignorado (AUDIOMACK_API_KEY/AUDIOMACK_API_SECRET não configurados)`);
  }

  // ── 3ª fonte: YouTube (pipeline existente, inalterado — Cobalt/yt-dlp + cookies) ──
  try {
    console.log(`[PLAY] YouTube: a pesquisar "${query}"`);
    const result = await searchYouTube(query);
    console.log(`[PLAY] YouTube: encontrado "${result.title}" — a descarregar`);
    const buffer = await downloadAudioWithFallback(result.url, statusFn);
    console.log(`[PLAY] YouTube: sucesso`);
    return { buffer, info: result, source: "YouTube" };
  } catch (err) {
    console.warn(`[PLAY] YouTube: falhou — ${err.message}`);
    console.error(`[PLAY] Fallback utilizado: nenhuma das 3 fontes conseguiu fornecer "${query}"`);
    throw new Error("Não encontrei essa música em nenhuma fonte disponível (SoundCloud, Audiomack e YouTube falharam).");
  }
}

/**
 * Descarrega ÁUDIO com Cobalt → fallback yt-dlp.
 * @returns {Promise<Buffer>}
 */
async function downloadAudioWithFallback(url, statusFn) {
  await statusFn("📥 *Preparando download...*");

  // Tentativa 1: Cobalt — só corre se o utilizador configurou uma instância própria
  // (COBALT_API_URL). A instância pública não é usada por omissão em 2026.
  if (isCobaltEnabled()) {
    try {
      const cobalt = await cobaltFetch(url, "audio");
      const buffer = await cobaltDownloadBuffer(cobalt.url);
      console.log("[downloader] áudio via Cobalt ✅");
      return buffer;
    } catch (cobaltErr) {
      console.warn(`[downloader] Cobalt falhou (áudio): ${cobaltErr.message}`);
      // A troca de método é silenciosa para o utilizador — apenas o log regista.
    }
  }

  // Tentativa 2 (motor principal): yt-dlp
  try {
    await statusFn("📦 *Baixando...*");
    const buffer = await ytdlpAudio(url);
    console.log("[downloader] áudio via yt-dlp ✅");
    return buffer;
  } catch (ytErr) {
    throw new Error(ytErr.message);
  }
}

/**
 * Descarrega VÍDEO com Cobalt → fallback yt-dlp.
 * @returns {Promise<string>} — caminho do ficheiro criado
 */
async function downloadVideoWithFallback(url, statusFn) {
  ensureTmp();
  const filePath = path.join(TMP_DIR, `video_${Date.now()}.mp4`);

  await statusFn("📥 *Preparando download...*");

  // Tentativa 1: Cobalt — só corre com instância própria configurada (COBALT_API_URL)
  if (isCobaltEnabled()) {
    try {
      const cobalt = await cobaltFetch(url, "auto", "720");
      await cobaltDownloadFile(cobalt.url, filePath);
      console.log("[downloader] vídeo via Cobalt ✅");
      return filePath;
    } catch (cobaltErr) {
      console.warn(`[downloader] Cobalt falhou (vídeo): ${cobaltErr.message}`);
      if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch {}
    }
  }

  // Tentativa 2 (motor principal): yt-dlp — cobre YouTube, TikTok, Instagram,
  // Facebook, X e Reddit sem depender de nenhuma API externa.
  try {
    await statusFn("📦 *Baixando...*");
    await ytdlpVideo(url, filePath);
    console.log("[downloader] vídeo via yt-dlp ✅");
    return filePath;
  } catch (ytErr) {
    if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch {}
    throw new Error(ytErr.message);
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
    let url, info, buffer;

    if (isUrl(input)) {
      // Link directo (YouTube, TikTok, etc.) — comportamento EXACTAMENTE
      // igual ao anterior. Não passa pelas fontes SoundCloud/Audiomack.
      ({ url, info } = await resolveInput(input, "audio", status));

      if (info.duration && info.duration > 720) {
        return status(`⚠️ Conteúdo demasiado longo (${formatDuration(info.duration)}). Máximo: 12 minutos.`);
      }

      await status("📦 *A baixar...*");
      buffer = await downloadAudioWithFallback(url, status);
    } else {
      // Pesquisa por nome — nova ordem: SoundCloud → Audiomack → YouTube.
      const resolved = await resolveAudioByText(input, status);
      buffer = resolved.buffer;
      info   = resolved.info;

      if (info.duration && info.duration > 720) {
        return status(`⚠️ Conteúdo demasiado longo (${formatDuration(info.duration)}). Máximo: 12 minutos.`);
      }
    }

    // 4. Verifica tamanho (limite WhatsApp: 16MB áudio)
    const sizeMB = buffer.length / (1024 * 1024);
    if (sizeMB > 16) {
      return status(`⚠️ Ficheiro demasiado grande (${sizeMB.toFixed(1)}MB). Tenta conteúdo mais curto.`);
    }

    // 5. Envia
    await status("📤 *Enviando...*");
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
    await status(`❌ *Não foi possível descarregar o áudio.*\n\n${err.message}`);
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
    await status("📤 *Enviando...*");
    await sock.sendMessage(jid, {
      video:    fs.readFileSync(filePath),
      mimetype: "video/mp4",
      caption:  `🎬 ${info.title || "Vídeo"}`,
    }, { quoted: msg });

    try { await sock.sendMessage(jid, { delete: statusMsg?.key }); } catch {}

    console.log(`[downloader] ✅ Vídeo enviado: ${info.title}`);

  } catch (err) {
    console.error(`[downloader] ❌ Erro vídeo: ${err.message}`);
    await status(`❌ *Não foi possível descarregar o vídeo.*\n\n${err.message}`);
  } finally {
    if (filePath && fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch {}
  }
}
