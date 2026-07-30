/**
 * lib/media/cobalt.js
 *
 * Cliente da Cobalt API — método OPCIONAL de download (instância própria).
 *
 * IMPORTANTE (2026): a instância pública (api.cobalt.tools) usa proteção
 * anti-bot e a própria documentação oficial da Cobalt afirma que não é
 * destinada a uso programático de terceiros sem permissão explícita.
 * Por isso deixou de ser usada por omissão neste projecto — o motor
 * principal passou a ser o yt-dlp (ver ytdlp.js).
 *
 * Quem tiver uma instância própria da Cobalt (self-hosted, ver
 * https://github.com/imputnet/cobalt) pode reactivar este módulo
 * definindo a variável de ambiente COBALT_API_URL com o URL dessa
 * instância. Sem essa variável, isCobaltEnabled() devolve false e o
 * downloader.js ignora completamente este módulo.
 */

const COBALT_API = process.env.COBALT_API_URL || null;
const TIMEOUT_MS = 20_000; // 20s — se não responder, passa para yt-dlp

/**
 * Indica se existe uma instância Cobalt configurada explicitamente.
 * @returns {boolean}
 */
export function isCobaltEnabled() {
  return Boolean(COBALT_API);
}

/**
 * Solicita à Cobalt o download de um URL.
 * @param {string}  url        — URL da plataforma (YouTube, TikTok, etc.)
 * @param {"auto"|"audio"|"mute"} audioMode
 *   "auto"  → vídeo com áudio (padrão)
 *   "audio" → apenas áudio
 *   "mute"  → vídeo sem áudio
 * @param {string}  quality    — qualidade do vídeo ("1080", "720", "480", "360")
 * @returns {Promise<{ url: string, filename: string, type: "redirect"|"stream"|"picker" }>}
 * @throws se a Cobalt não suportar o URL ou estiver indisponível
 */
export async function cobaltFetch(url, audioMode = "auto", quality = "480") {
  if (!COBALT_API) {
    throw new Error("Cobalt desativada — nenhuma COBALT_API_URL configurada (ver README)");
  }

  const body = {
    url,
    videoQuality:    quality,
    audioFormat:     "mp3",
    downloadMode:    audioMode,   // "auto" | "audio" | "mute"
    filenameStyle:   "pretty",
    disableMetadata: false,
  };

  console.log(`[cobalt] A solicitar: ${url} | modo=${audioMode} | qualidade=${quality}`);

  const res = await fetch(`${COBALT_API}/`, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept":       "application/json",
    },
    body:   JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`Cobalt respondeu ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  // Cobalt devolve status: "stream", "redirect", "picker", "error", "rate-limit"
  if (data.status === "error" || data.status === "rate-limit") {
    throw new Error(`Cobalt erro: ${data.error?.code || data.status}`);
  }

  if (!data.url && !data.urls) {
    throw new Error("Cobalt não devolveu URL de download");
  }

  console.log(`[cobalt] ✅ Recebido: status=${data.status} | filename=${data.filename}`);

  return {
    url:      data.url || data.urls?.[0]?.url,
    filename: data.filename || "media",
    type:     data.status, // "redirect" | "stream" | "picker"
  };
}

/**
 * Descarrega o conteúdo do URL retornado pela Cobalt para um Buffer.
 * @param {string} downloadUrl
 * @returns {Promise<Buffer>}
 */
export async function cobaltDownloadBuffer(downloadUrl) {
  console.log(`[cobalt] A descarregar buffer de: ${downloadUrl.slice(0, 80)}...`);

  const res = await fetch(downloadUrl, {
    signal: AbortSignal.timeout(300_000), // 5min para o download em si
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!res.ok) throw new Error(`Download Cobalt falhou: ${res.status}`);

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length < 1000) throw new Error("Buffer Cobalt demasiado pequeno — download incompleto");

  console.log(`[cobalt] ✅ Buffer recebido: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
  return buffer;
}

/**
 * Descarrega o conteúdo do URL retornado pela Cobalt para um ficheiro.
 * @param {string} downloadUrl
 * @param {string} outputPath
 */
export async function cobaltDownloadFile(downloadUrl, outputPath) {
  const { createWriteStream } = await import("fs");
  const { pipeline }          = await import("stream/promises");

  console.log(`[cobalt] A descarregar ficheiro para: ${outputPath}`);

  const res = await fetch(downloadUrl, {
    signal: AbortSignal.timeout(300_000),
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!res.ok) throw new Error(`Download Cobalt falhou: ${res.status}`);

  await pipeline(res.body, createWriteStream(outputPath));
  console.log(`[cobalt] ✅ Ficheiro gravado: ${outputPath}`);
}
