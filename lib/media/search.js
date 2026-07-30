/**
 * lib/media/search.js
 *
 * Pesquisa de media por nome (quando o utilizador não envia um link).
 * Usa yt-dlp ytsearch para YouTube (já disponível no projecto).
 * Usa tikwm API para TikTok.
 * Para outras plataformas faz fallback para YouTube.
 */
import { spawn } from "child_process";
import { getBin, commonArgs } from "./ytdlp.js";

function formatDuration(secs) {
  if (!secs) return "?";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function formatViews(n) {
  if (!n) return "?";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * Pesquisa no YouTube por nome e retorna o primeiro resultado.
 * @param {string} query
 * @returns {Promise<MediaInfo>}
 */
export async function searchYouTube(query) {
  return new Promise((resolve, reject) => {
    console.log(`[search] YouTube: "${query}"`);

    const args = [
      `ytsearch1:${query}`,
      "--dump-json",
      "--no-playlist",
      "--quiet",
      ...commonArgs(),
    ];

    const proc = spawn(getBin(), args, { detached: true });
    let out = "", err = "";

    proc.stdout.on("data", d => { out += d; });
    proc.stderr.on("data", d => { err += d; });

    const timer = setTimeout(() => {
      try { process.kill(-proc.pid, "SIGKILL"); } catch { try { proc.kill("SIGKILL"); } catch {} }
      reject(new Error("Pesquisa YouTube timeout (40s) — provável bloqueio anti-bot do YouTube"));
    }, 40_000);

    proc.on("close", code => {
      clearTimeout(timer);
      if (code !== 0 || !out.trim()) {
        return reject(new Error(`Pesquisa falhou (${code}): ${err.slice(0, 200)}`));
      }
      try {
        const i = JSON.parse(out.trim());
        console.log(`[search] ✅ YouTube: "${i.title}" (${i.duration}s)`);
        resolve({
          platform:  "YouTube",
          title:     i.title     || "Sem título",
          url:       i.webpage_url || `https://youtube.com/watch?v=${i.id}`,
          duration:  i.duration  || 0,
          durationFmt: formatDuration(i.duration),
          thumbnail: i.thumbnail || null,
          uploader:  i.uploader  || i.channel || "Desconhecido",
          views:     formatViews(i.view_count),
          viewCount: i.view_count || 0,
        });
      } catch {
        reject(new Error("Erro ao processar resultado da pesquisa"));
      }
    });
  });
}

/**
 * Pesquisa no TikTok por nome usando a API pública tikwm.
 * @param {string} query
 * @returns {Promise<MediaInfo>}
 */
export async function searchTikTok(query) {
  console.log(`[search] TikTok: "${query}"`);

  const res = await fetch(
    `https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(query)}&count=1`,
    {
      signal:  AbortSignal.timeout(15_000),
      headers: { "User-Agent": "Mozilla/5.0" },
    }
  );

  if (!res.ok) throw new Error(`Pesquisa TikTok falhou (${res.status})`);

  const data = await res.json();
  const item = data?.data?.videos?.[0];

  if (!item) throw new Error("Nenhum resultado TikTok encontrado");

  console.log(`[search] ✅ TikTok: "${item.title}"`);

  return {
    platform:    "TikTok",
    title:       item.title || "Vídeo TikTok",
    url:         `https://www.tiktok.com/@${item.author?.unique_id || "user"}/video/${item.video_id}`,
    duration:    item.duration || 0,
    durationFmt: formatDuration(item.duration),
    thumbnail:   item.cover   || null,
    uploader:    item.author?.nickname || "TikTok",
    views:       formatViews(item.play_count),
    viewCount:   item.play_count || 0,
  };
}

/**
 * Pesquisa genérica — usa YouTube como base para qualquer plataforma.
 * @param {string} query
 * @param {string} platform — nome da plataforma para contexto no log
 * @returns {Promise<MediaInfo>}
 */
export async function searchGeneric(query, platform = "Web") {
  console.log(`[search] Genérico (${platform}): "${query}"`);
  const result = await searchYouTube(query);
  result.platform = platform;
  return result;
}
