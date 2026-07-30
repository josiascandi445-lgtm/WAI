/**
 * lib/media/ytdlp.js
 *
 * Wrapper do yt-dlp — motor PRINCIPAL de download (vídeo + áudio + pesquisa).
 * A Cobalt deixou de ser o método principal (ver cobalt.js) porque a
 * instância pública (api.cobalt.tools) não é utilizável para downloads
 * de terceiros em produção. yt-dlp continua a ser a ferramenta mais
 * completa e mais actualizada disponível gratuitamente em 2026.
 *
 * Correcções desta versão:
 * - stdout SEMPRE consumido (evita deadlock de pipe / timeouts falsos).
 * - killProcessTree() mata o grupo inteiro (yt-dlp + ffmpeg filho).
 * - --ffmpeg-location aponta para o ffmpeg "vendored" em ./bin quando existe.
 * - Suporte a cookies (YTDLP_COOKIES_FILE ou YTDLP_COOKIES_B64) — necessário
 *   porque o YouTube passou a exigir autenticação/PO-Token para libertar
 *   todos os formatos a partir de IPs de datacenter (Render/Railway).
 * - extractor-args com "formats=missing_pot" — flag oficial do yt-dlp para
 *   continuar a devolver formatos mesmo quando falta o PO Token, em vez de
 *   abortar por completo (troca: pode devolver menos qualidade, mas funciona).
 * - Classificação do erro no log (bot-detection / rede / ficheiro em falta)
 *   para facilitar diagnóstico futuro sem ter de reler stderr inteiro.
 */
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const BIN_DIR     = path.join(__dirname, "../../bin");
const YTDLP_PATH  = path.join(BIN_DIR, "yt-dlp");
const FFMPEG_PATH = path.join(BIN_DIR, "ffmpeg");
const TMP_DIR     = path.join(__dirname, "../../tmp");
const MAX_STDERR  = 4000;

export function getBin() {
  return fs.existsSync(YTDLP_PATH) ? YTDLP_PATH : "yt-dlp";
}

export function getFfmpegLocation() {
  return fs.existsSync(FFMPEG_PATH) ? BIN_DIR : null; // yt-dlp aceita uma pasta
}

export function ensureTmp() {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
}

/**
 * Resolve o ficheiro de cookies a usar (se configurado).
 * - YTDLP_COOKIES_FILE: caminho directo para um cookies.txt já existente no disco.
 * - YTDLP_COOKIES_B64:  conteúdo do cookies.txt codificado em base64 (útil em
 *   plataformas onde não dá para montar um ficheiro persistente, ex: Railway).
 * Ver README/.env.example para instruções de como gerar o cookies.txt.
 */
let cachedCookiesPath;
export function getCookiesFile() {
  if (cachedCookiesPath !== undefined) return cachedCookiesPath;

  if (process.env.YTDLP_COOKIES_FILE && fs.existsSync(process.env.YTDLP_COOKIES_FILE)) {
    cachedCookiesPath = process.env.YTDLP_COOKIES_FILE;
    console.log(`[ytdlp] cookies: a usar ficheiro em YTDLP_COOKIES_FILE`);
    return cachedCookiesPath;
  }

  if (process.env.YTDLP_COOKIES_B64) {
    try {
      ensureTmp();
      const dest = path.join(TMP_DIR, "cookies.txt");
      fs.writeFileSync(dest, Buffer.from(process.env.YTDLP_COOKIES_B64, "base64"));
      cachedCookiesPath = dest;
      console.log(`[ytdlp] cookies: ficheiro gerado a partir de YTDLP_COOKIES_B64`);
      return cachedCookiesPath;
    } catch (e) {
      console.warn(`[ytdlp] cookies: falha ao decodificar YTDLP_COOKIES_B64 — ${e.message}`);
    }
  }

  cachedCookiesPath = null;
  return null;
}

/**
 * Argumentos comuns a qualquer chamada yt-dlp: ffmpeg, cookies, extractor-args
 * e opções de robustez (retries) partilhadas entre pesquisa/áudio/vídeo.
 */
export function commonArgs() {
  const args = [
    "--no-warnings", "--newline",
    "--retries", "3", "--fragment-retries", "3",
    "--socket-timeout", "20",
    // Ajuda a evitar bloqueios de PO-Token: tenta o cliente "android" primeiro
    // (não exige PO-Token na maioria dos vídeos) e cai para "web" se preciso.
    "--extractor-args", "youtube:player_client=android,web;formats=missing_pot",
  ];

  const ffmpegDir = getFfmpegLocation();
  if (ffmpegDir) args.push("--ffmpeg-location", ffmpegDir);

  const cookies = getCookiesFile();
  if (cookies) args.push("--cookies", cookies);

  return args;
}

function killTree(proc, label) {
  try { process.kill(-proc.pid, "SIGKILL"); }
  catch { try { proc.kill("SIGKILL"); } catch {} }
  console.log(`[ytdlp:${label}] processo terminado (PID ${proc.pid})`);
}

/** Classifica o erro para o log ficar imediatamente útil. */
function classifyError(stderr) {
  const s = stderr.toLowerCase();
  if (s.includes("sign in to confirm") || s.includes("po token") || s.includes("bot"))
    return "BOT_DETECTION (YouTube pediu verificação — configura YTDLP_COOKIES_B64, ver README)";
  if (s.includes("unable to download webpage") || s.includes("network") || s.includes("timed out"))
    return "REDE (falha de ligação ao extrair o vídeo)";
  if (s.includes("unsupported url"))
    return "URL_NAO_SUPORTADO";
  if (s.includes("ffmpeg not found") || s.includes("ffmpeg is not installed"))
    return "FFMPEG_EM_FALTA";
  if (s.includes("video unavailable") || s.includes("private video"))
    return "VIDEO_INDISPONIVEL";
  return "DESCONHECIDO";
}

// Spawn com stdout SEMPRE drenado — fix do deadlock de pipe
function spawnYtdlp(args, label) {
  console.log(`[ytdlp:${label}] spawn: ${args.slice(0, 4).join(" ")} ...`);
  const proc = spawn(getBin(), args, { detached: true });

  let stderrBuf = "";
  let lastLog   = 0;

  proc.stdout.on("data", d => {
    const now = Date.now();
    if (now - lastLog > 2000) {
      lastLog = now;
      const linha = d.toString().trim().split("\n").pop() || "";
      if (linha) console.log(`[ytdlp:${label}] ${linha.slice(0, 100)}`);
    }
  });

  proc.stderr.on("data", d => {
    if (stderrBuf.length < MAX_STDERR) stderrBuf += d.toString();
  });

  proc.on("error", e => console.error(`[ytdlp:${label}] spawn error: ${e.message}`));

  return { proc, stderr: () => stderrBuf };
}

/**
 * Download de áudio via yt-dlp → Buffer
 */
export async function ytdlpAudio(url) {
  ensureTmp();
  const outBase = path.join(TMP_DIR, `audio_${Date.now()}`);
  const label   = "audio";

  return new Promise((resolve, reject) => {
    const args = [
      url,
      "--format", "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best",
      "--extract-audio", "--audio-format", "mp3", "--audio-quality", "0",
      "--no-playlist",
      ...commonArgs(),
      "-o", `${outBase}.%(ext)s`,
    ];

    const { proc, stderr } = spawnYtdlp(args, label);

    const timer = setTimeout(() => {
      killTree(proc, label);
      reject(new Error("yt-dlp áudio timeout (5min)"));
    }, 300_000);

    proc.on("close", code => {
      clearTimeout(timer);
      console.log(`[ytdlp:${label}] exit ${code}`);

      if (code !== 0) {
        const err = stderr();
        return reject(new Error(`yt-dlp falhou [${classifyError(err)}]: ${err.slice(0, 300)}`));
      }

      const files = fs.readdirSync(TMP_DIR)
        .filter(f => f.startsWith(path.basename(outBase)))
        .map(f => path.join(TMP_DIR, f));

      if (!files.length) return reject(new Error("Ficheiro de áudio não encontrado após download"));

      const buf = fs.readFileSync(files[0]);
      files.forEach(f => { try { fs.unlinkSync(f); } catch {} });

      if (buf.length < 1000) return reject(new Error("Ficheiro de áudio vazio (provável falha silenciosa do ffmpeg)"));

      console.log(`[ytdlp:${label}] ✅ ${(buf.length / 1024 / 1024).toFixed(2)}MB`);
      resolve(buf);
    });
  });
}

/**
 * Download de vídeo via yt-dlp → ficheiro em disco
 */
export async function ytdlpVideo(url, outputPath) {
  const label = "video";

  return new Promise((resolve, reject) => {
    const args = [
      url,
      "--format", "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=480]/best",
      "--merge-output-format", "mp4",
      "--no-playlist",
      ...commonArgs(),
      "-o", outputPath,
    ];

    const { proc, stderr } = spawnYtdlp(args, label);

    const timer = setTimeout(() => {
      killTree(proc, label);
      reject(new Error("yt-dlp vídeo timeout (8min)"));
    }, 480_000);

    proc.on("close", code => {
      clearTimeout(timer);
      console.log(`[ytdlp:${label}] exit ${code}`);
      if (code !== 0) {
        const err = stderr();
        return reject(new Error(`yt-dlp falhou [${classifyError(err)}]: ${err.slice(0, 300)}`));
      }
      if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1000) {
        return reject(new Error("Ficheiro de vídeo vazio ou não encontrado (provável falha silenciosa do ffmpeg)"));
      }
      console.log(`[ytdlp:${label}] ✅ ${outputPath}`);
      resolve();
    });
  });
}
