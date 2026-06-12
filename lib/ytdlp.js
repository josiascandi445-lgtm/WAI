/**
 * lib/ytdlp.js — Wrapper Node.js para o binário yt-dlp
 *
 * CORRECÇÕES nesta versão:
 * - downloadAudio: removido --extract-audio + --audio-format mp3 quando output é stdout (pipe).
 *   O yt-dlp não consegue fazer conversão ffmpeg quando o output é "-" (pipe), porque o ffmpeg
 *   precisa de um ficheiro temporário. A solução é gravar para ficheiro temporário e depois ler.
 * - downloadVideo: igual — grava para ficheiro e lê.
 * - Timeouts aumentados: search 45s, audio 4min, video 6min.
 */
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const YTDLP_PATH = path.join(__dirname, "../bin/yt-dlp");
const TMP_DIR    = path.join(__dirname, "../tmp");

function getYtdlpBin() {
  if (fs.existsSync(YTDLP_PATH)) return YTDLP_PATH;
  return "yt-dlp";
}

function ensureTmp() {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
}

/**
 * Pesquisa no YouTube e retorna info do primeiro resultado.
 */
export async function ytSearch(query) {
  return new Promise((resolve, reject) => {
    const bin = getYtdlpBin();
    const args = [
      `ytsearch1:${query}`,
      "--dump-json",
      "--no-playlist",
      "--no-warnings",
      "--quiet",
    ];

    const proc = spawn(bin, args);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", d => { stdout += d.toString(); });
    proc.stderr.on("data", d => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error("yt-dlp search timeout (45s)"));
    }, 45_000);

    proc.on("close", code => {
      clearTimeout(timer);
      if (code !== 0 || !stdout.trim()) {
        return reject(new Error(`yt-dlp search falhou (${code}): ${stderr.slice(0, 200)}`));
      }
      try {
        const info = JSON.parse(stdout.trim());
        resolve({
          title:     info.title     || "Sem título",
          url:       info.webpage_url || `https://www.youtube.com/watch?v=${info.id}`,
          duration:  info.duration  || 0,
          thumbnail: info.thumbnail || null,
          uploader:  info.uploader  || info.channel || "Desconhecido",
          viewCount: info.view_count || 0,
        });
      } catch {
        reject(new Error("Falha ao parsear resultado do yt-dlp"));
      }
    });
  });
}

/**
 * Descarrega áudio para ficheiro temporário e retorna Buffer.
 * FIX: usa ficheiro em vez de pipe para permitir conversão ffmpeg.
 */
export async function downloadAudio(url) {
  ensureTmp();
  const outPath = path.join(TMP_DIR, `audio_${Date.now()}.mp3`);

  return new Promise((resolve, reject) => {
    const bin = getYtdlpBin();
    const args = [
      url,
      "--format", "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best",
      "--extract-audio",
      "--audio-format", "mp3",
      "--audio-quality", "5",
      "--no-playlist",
      "--no-warnings",
      "-o", outPath,
    ];

    const proc = spawn(bin, args);
    let stderr = "";

    proc.stderr.on("data", d => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      if (fs.existsSync(outPath)) try { fs.unlinkSync(outPath); } catch {}
      reject(new Error("yt-dlp audio download timeout (4min)"));
    }, 240_000);

    proc.on("close", code => {
      clearTimeout(timer);

      // yt-dlp pode escrever para outPath.mp3 mesmo que outPath já tenha .mp3
      // Tenta os dois caminhos
      const finalPath = fs.existsSync(outPath) ? outPath : outPath.replace(/\.mp3$/, "") + ".mp3";

      if (code !== 0) {
        if (fs.existsSync(finalPath)) try { fs.unlinkSync(finalPath); } catch {}
        return reject(new Error(`yt-dlp audio falhou (${code}): ${stderr.slice(0, 300)}`));
      }

      if (!fs.existsSync(finalPath) || fs.statSync(finalPath).size < 1000) {
        return reject(new Error("Ficheiro de áudio vazio ou não criado"));
      }

      const buf = fs.readFileSync(finalPath);
      try { fs.unlinkSync(finalPath); } catch {}
      resolve(buf);
    });
  });
}

/**
 * Descarrega vídeo para ficheiro e retorna o path.
 */
export async function downloadVideo(url, outputPath) {
  return new Promise((resolve, reject) => {
    const bin = getYtdlpBin();
    const args = [
      url,
      "--format", "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]/best",
      "--merge-output-format", "mp4",
      "--no-playlist",
      "--no-warnings",
      "-o", outputPath,
    ];

    const proc = spawn(bin, args);
    let stderr = "";

    proc.stderr.on("data", d => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      if (fs.existsSync(outputPath)) try { fs.unlinkSync(outputPath); } catch {}
      reject(new Error("yt-dlp video download timeout (6min)"));
    }, 360_000);

    proc.on("close", code => {
      clearTimeout(timer);
      if (code !== 0) {
        return reject(new Error(`yt-dlp video falhou (${code}): ${stderr.slice(0, 300)}`));
      }
      resolve();
    });
  });
}
