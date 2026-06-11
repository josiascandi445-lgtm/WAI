/**
 * lib/ytdlp.js — Wrapper Node.js para o binário yt-dlp
 *
 * PORQUÊ yt-dlp em vez de @distube/ytdl-core:
 * O YouTube bloqueia activamente IPs de servidores cloud (AWS, Render, etc.)
 * a partir de 2024. O ytdl-core e forks dependem da API interna do YouTube
 * que é bloqueada por esses IPs. O yt-dlp contorna isso com uma estratégia
 * diferente de extracção e é actualizado muito mais frequentemente.
 *
 * O binário é descarregado durante o build do Render (ver render.yaml).
 */
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Caminho do binário — descarregado pelo buildCommand do Render
const YTDLP_PATH = path.join(__dirname, "../bin/yt-dlp");
// Fallback: se estiver no PATH do sistema
const YTDLP_FALLBACK = "yt-dlp";

function getYtdlpBin() {
  if (fs.existsSync(YTDLP_PATH)) return YTDLP_PATH;
  return YTDLP_FALLBACK;
}

/**
 * Pesquisa no YouTube e retorna info do primeiro resultado.
 * @param {string} query
 * @returns {Promise<{title, url, duration, thumbnail}>}
 */
export async function ytSearch(query) {
  return new Promise((resolve, reject) => {
    const bin = getYtdlpBin();
    const args = [
      `ytsearch1:${query}`,
      "--dump-json",
      "--no-playlist",
      "--quiet",
    ];

    const proc = spawn(bin, args);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", d => { stdout += d.toString(); });
    proc.stderr.on("data", d => { stderr += d.toString(); });

    proc.on("close", code => {
      if (code !== 0 || !stdout.trim()) {
        return reject(new Error(`yt-dlp search falhou: ${stderr.slice(0, 200)}`));
      }
      try {
        const info = JSON.parse(stdout.trim());
        resolve({
          title:     info.title,
          url:       info.webpage_url || `https://www.youtube.com/watch?v=${info.id}`,
          duration:  info.duration || 0,
          thumbnail: info.thumbnail,
          uploader:  info.uploader,
        });
      } catch (e) {
        reject(new Error("Falha ao parsear resultado do yt-dlp"));
      }
    });

    // Timeout de 30s para a pesquisa
    setTimeout(() => { proc.kill(); reject(new Error("yt-dlp search timeout")); }, 30_000);
  });
}

/**
 * Descarrega áudio de um URL YouTube para buffer.
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
export async function downloadAudio(url) {
  return new Promise((resolve, reject) => {
    const bin = getYtdlpBin();
    const args = [
      url,
      "--format", "bestaudio[ext=m4a]/bestaudio/best",
      "--extract-audio",
      "--audio-format", "mp3",
      "--audio-quality", "5",       // qualidade média (0=melhor, 9=pior)
      "--no-playlist",
      "--quiet",
      "-o", "-",                    // output para stdout → pipe para Node
    ];

    const proc = spawn(bin, args);
    const chunks = [];
    let stderr = "";

    proc.stdout.on("data", d => chunks.push(d));
    proc.stderr.on("data", d => { stderr += d.toString(); });

    proc.on("close", code => {
      if (code !== 0) {
        return reject(new Error(`yt-dlp audio falhou (${code}): ${stderr.slice(0, 300)}`));
      }
      const buf = Buffer.concat(chunks);
      if (buf.length < 1000) {
        return reject(new Error("Buffer de áudio demasiado pequeno — download falhou"));
      }
      resolve(buf);
    });

    // Timeout de 3 minutos para download
    setTimeout(() => { proc.kill(); reject(new Error("yt-dlp audio download timeout")); }, 180_000);
  });
}

/**
 * Descarrega vídeo de um URL YouTube para ficheiro.
 * @param {string} url
 * @param {string} outputPath
 * @returns {Promise<void>}
 */
export async function downloadVideo(url, outputPath) {
  return new Promise((resolve, reject) => {
    const bin = getYtdlpBin();
    const args = [
      url,
      "--format", "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]/best",
      "--merge-output-format", "mp4",
      "--no-playlist",
      "--quiet",
      "-o", outputPath,
    ];

    const proc = spawn(bin, args);
    let stderr = "";

    proc.stderr.on("data", d => { stderr += d.toString(); });

    proc.on("close", code => {
      if (code !== 0) {
        return reject(new Error(`yt-dlp video falhou (${code}): ${stderr.slice(0, 300)}`));
      }
      resolve();
    });

    // Timeout de 5 minutos para vídeo
    setTimeout(() => { proc.kill(); reject(new Error("yt-dlp video download timeout")); }, 300_000);
  });
}
