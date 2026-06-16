/**
 * lib/ytdlp.js — Wrapper para yt-dlp
 *
 * FIX desta versão:
 * - tiktokSearch: removido "tiktoksearch:" que NÃO EXISTE no yt-dlp.
 *   Isto fazia o processo ficar pendurado até atingir o timeout sempre
 *   que se usava .tk com texto em vez de URL directa.
 *   Agora usa uma API pública de pesquisa TikTok para obter o URL real
 *   e só depois passa esse URL ao yt-dlp.
 * - Timeouts reduzidos para falhar mais rápido quando a rede está bloqueada,
 *   com mensagens de diagnóstico mais claras.
 * - Adicionado spotifySearch: localiza a faixa equivalente no YouTube
 *   (o Spotify usa DRM — não é possível descarregar directamente de lá).
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

    const timer = setTimeout(() => { proc.kill("SIGKILL"); reject(new Error("Pesquisa timeout (60s) — rede pode estar lenta")); }, 60_000);

    proc.on("close", code => {
      clearTimeout(timer);
      if (code !== 0 || !out.trim()) return reject(new Error(`Pesquisa falhou: ${err.slice(0, 300)}`));
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

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error("Download de áudio timeout (8min) — tenta música mais curta"));
    }, 480_000);

    proc.on("close", code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`Download falhou (${code}): ${err.slice(0, 300)}`));

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

// ─── TIKTOK ──────────────────────────────────────────────────────────────────
// FIX: yt-dlp não suporta pesquisa nativa "tiktoksearch:" — isso fazia o
// processo ficar pendurado. Para pesquisa por texto usamos uma API pública,
// e o resultado (URL real) é depois passado ao yt-dlp para download normal.

export async function downloadTikTok(url, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      url,
      "--format", "mp4/best",
      "--no-playlist", "--no-warnings",
      "-o", outputPath,
    ];

    const proc = spawn(getBin(), args);
    let err = "";
    proc.stderr.on("data", d => { err += d; });

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error("Download TikTok timeout (3min)"));
    }, 180_000);

    proc.on("close", code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`TikTok download falhou (${code}): ${err.slice(0, 300)}`));
      resolve();
    });
  });
}

// Pesquisa TikTok por texto usando API pública (tikwm) — retorna o URL real do vídeo
export async function tiktokSearch(query) {
  const res = await fetch(`https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(query)}&count=1`, {
    signal: AbortSignal.timeout(15_000),
    headers: { "User-Agent": "Mozilla/5.0" }
  });

  if (!res.ok) throw new Error(`Pesquisa TikTok falhou (${res.status})`);

  const data = await res.json();
  const item = data?.data?.videos?.[0];

  if (!item) throw new Error("Nenhum vídeo encontrado no TikTok");

  return {
    title: item.title || "Vídeo TikTok",
    url: `https://www.tiktok.com/@${item.author?.unique_id || "user"}/video/${item.video_id}`,
    duration: item.duration || 0,
    thumbnail: item.cover || null,
    uploader: item.author?.nickname || "TikTok",
  };
}

// ─── SPOTIFY ─────────────────────────────────────────────────────────────────
// O Spotify usa DRM nos seus ficheiros de áudio — não é possível descarregar
// directamente de lá. A abordagem padrão (usada por todos os bots legítimos)
// é localizar a mesma faixa no YouTube e descarregar de lá.
export async function spotifySearch(query) {
  // Reutiliza a pesquisa do YouTube — mesma faixa, fonte legal
  return ytSearch(`${query} audio`);
}
