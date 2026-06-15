/**
 * lib/ytdlp.js — Wrapper para yt-dlp
 * FIX: timeouts aumentados para o Render free tier (CPU muito lenta).
 * FIX: áudio sem conversão ffmpeg (evita overhead de CPU).
 * NOVO: função downloadTikTok para vídeos TikTok.
 */
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const YTDLP_PATH = path.join(__dirname, "../bin/yt-dlp");
const TMP_DIR    = path.join(__dirname, "../tmp");

function getBin() {
  return fs.existsSync(YTDLP_PATH) ? YTDLP_PATH : "yt-dlp";
}

function ensureTmp() {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
}

export async function ytSearch(query) {
  return new Promise((resolve, reject) => {
    const args = [`ytsearch1:${query}`, "--dump-json", "--no-playlist", "--no-warnings", "--quiet"];
    const proc = spawn(getBin(), args);
    let out = "", err = "";
    proc.stdout.on("data", d => { out += d; });
    proc.stderr.on("data", d => { err += d; });

    const timer = setTimeout(() => { proc.kill("SIGKILL"); reject(new Error("Pesquisa timeout (60s)")); }, 60_000);

    proc.on("close", code => {
      clearTimeout(timer);
      if (code !== 0 || !out.trim()) return reject(new Error(`Pesquisa falhou: ${err.slice(0, 200)}`));
      try {
        const info = JSON.parse(out.trim());
        resolve({
          title:    info.title || "Sem título",
          url:      info.webpage_url || `https://youtube.com/watch?v=${info.id}`,
          duration: info.duration || 0,
          thumbnail: info.thumbnail || null,
          uploader: info.uploader || info.channel || "Desconhecido",
          viewCount: info.view_count || 0,
        });
      } catch { reject(new Error("Erro ao processar resultado")); }
    });
  });
}

export async function downloadAudio(url) {
  ensureTmp();
  // FIX: usa m4a directamente SEM conversão ffmpeg — muito mais rápido no Render
  // O WhatsApp aceita m4a/aac como áudio
  const outBase = path.join(TMP_DIR, `audio_${Date.now()}`);

  return new Promise((resolve, reject) => {
    const args = [
      url,
      "--format", "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio",
      "--no-playlist", "--no-warnings",
      "-o", `${outBase}.%(ext)s`,
    ];

    const proc = spawn(getBin(), args);
    let err = "";
    proc.stderr.on("data", d => { err += d; });

    // FIX: timeout aumentado para 8 minutos (Render free tem CPU muito lenta)
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error("Download de áudio timeout (8min) — tenta música mais curta"));
    }, 480_000);

    proc.on("close", code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`Download falhou (${code}): ${err.slice(0, 300)}`));

      // Procura o ficheiro criado (extensão pode variar)
      const files = fs.readdirSync(TMP_DIR)
        .filter(f => f.startsWith(path.basename(outBase)))
        .map(f => path.join(TMP_DIR, f));

      if (!files.length || !fs.existsSync(files[0])) {
        return reject(new Error("Ficheiro de áudio não encontrado após download"));
      }

      const buf = fs.readFileSync(files[0]);
      files.forEach(f => { try { fs.unlinkSync(f); } catch {} });

      if (buf.length < 1000) return reject(new Error("Ficheiro de áudio vazio"));
      resolve(buf);
    });
  });
}

export async function downloadVideo(url, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      url,
      "--format", "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]/best",
      "--merge-output-format", "mp4",
      "--no-playlist", "--no-warnings",
      "-o", outputPath,
    ];

    const proc = spawn(getBin(), args);
    let err = "";
    proc.stderr.on("data", d => { err += d; });

    // FIX: timeout aumentado para 10 minutos
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error("Download de vídeo timeout (10min) — tenta vídeo mais curto"));
    }, 600_000);

    proc.on("close", code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`Download falhou (${code}): ${err.slice(0, 300)}`));
      resolve();
    });
  });
}

// NOVO: download de vídeo TikTok (sem marca de água quando possível)
export async function downloadTikTok(url, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      url,
      "--format", "mp4/best",
      "--no-playlist", "--no-warnings",
      // Remove marca de água TikTok quando disponível
      "--extractor-args", "tiktok:app_version=26.1.3",
      "-o", outputPath,
    ];

    const proc = spawn(getBin(), args);
    let err = "";
    proc.stderr.on("data", d => { err += d; });

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error("Download TikTok timeout (5min)"));
    }, 300_000);

    proc.on("close", code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`TikTok download falhou (${code}): ${err.slice(0, 300)}`));
      resolve();
    });
  });
}

// Pesquisa TikTok por texto (usa ytsearch como fallback)
export async function tiktokSearch(query) {
  return new Promise((resolve, reject) => {
    // Pesquisa no TikTok directamente
    const args = [
      `tiktoksearch:${query}`,
      "--dump-json",
      "--no-playlist",
      "--playlist-items", "1",
      "--no-warnings",
      "--quiet",
    ];

    const proc = spawn(getBin(), args);
    let out = "", err = "";
    proc.stdout.on("data", d => { out += d; });
    proc.stderr.on("data", d => { err += d; });

    const timer = setTimeout(() => { proc.kill("SIGKILL"); reject(new Error("TikTok search timeout")); }, 60_000);

    proc.on("close", code => {
      clearTimeout(timer);
      if (code !== 0 || !out.trim()) return reject(new Error(`TikTok search falhou: ${err.slice(0, 200)}`));
      try {
        const info = JSON.parse(out.split("\n")[0].trim());
        resolve({
          title:    info.title || info.description || "Vídeo TikTok",
          url:      info.webpage_url || info.url,
          duration: info.duration || 0,
          thumbnail: info.thumbnail || null,
          uploader: info.uploader || info.creator || "TikTok",
        });
      } catch { reject(new Error("Erro ao processar resultado TikTok")); }
    });
  });
}
