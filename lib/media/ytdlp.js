/**
 * lib/media/ytdlp.js
 *
 * Wrapper do yt-dlp — usado como FALLBACK quando a Cobalt falha.
 *
 * FIX crítico mantido desta versão:
 * - stdout SEMPRE consumido (proc.stdout.on("data",...)) para evitar
 *   deadlock de pipe que causava timeouts em todos os downloads.
 * - killProcessTree() mata o grupo inteiro (yt-dlp + ffmpeg filho).
 * - --newline para output linha-a-linha.
 */
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const YTDLP_PATH = path.join(__dirname, "../../bin/yt-dlp");
const TMP_DIR    = path.join(__dirname, "../../tmp");
const MAX_STDERR = 4000;

export function getBin() {
  return fs.existsSync(YTDLP_PATH) ? YTDLP_PATH : "yt-dlp";
}

export function ensureTmp() {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
}

function killTree(proc, label) {
  try { process.kill(-proc.pid, "SIGKILL"); }
  catch { try { proc.kill("SIGKILL"); } catch {} }
  console.log(`[ytdlp:${label}] processo terminado (PID ${proc.pid})`);
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
      "--format", "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio",
      "--no-playlist", "--no-warnings", "--newline",
      "-o", `${outBase}.%(ext)s`,
    ];

    const { proc, stderr } = spawnYtdlp(args, label);

    const timer = setTimeout(() => {
      killTree(proc, label);
      reject(new Error("yt-dlp áudio timeout (8min)"));
    }, 480_000);

    proc.on("close", code => {
      clearTimeout(timer);
      console.log(`[ytdlp:${label}] exit ${code}`);

      if (code !== 0) return reject(new Error(`yt-dlp falhou (${code}): ${stderr().slice(0, 300)}`));

      const files = fs.readdirSync(TMP_DIR)
        .filter(f => f.startsWith(path.basename(outBase)))
        .map(f => path.join(TMP_DIR, f));

      if (!files.length) return reject(new Error("Ficheiro de áudio não encontrado"));

      const buf = fs.readFileSync(files[0]);
      files.forEach(f => { try { fs.unlinkSync(f); } catch {} });

      if (buf.length < 1000) return reject(new Error("Ficheiro de áudio vazio"));

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
      "--format", "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]/best",
      "--merge-output-format", "mp4",
      "--no-playlist", "--no-warnings", "--newline",
      "-o", outputPath,
    ];

    const { proc, stderr } = spawnYtdlp(args, label);

    const timer = setTimeout(() => {
      killTree(proc, label);
      reject(new Error("yt-dlp vídeo timeout (10min)"));
    }, 600_000);

    proc.on("close", code => {
      clearTimeout(timer);
      console.log(`[ytdlp:${label}] exit ${code}`);
      if (code !== 0) return reject(new Error(`yt-dlp falhou (${code}): ${stderr().slice(0, 300)}`));
      console.log(`[ytdlp:${label}] ✅ ${outputPath}`);
      resolve();
    });
  });
}
