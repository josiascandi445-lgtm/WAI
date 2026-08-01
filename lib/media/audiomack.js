/**
 * lib/media/audiomack.js
 *
 * Cliente da API oficial do Audiomack (api.audiomack.com/v1) — SEGUNDA
 * fonte na ordem do ".play" (SoundCloud → Audiomack → YouTube).
 *
 * A API do Audiomack usa OAuth 1.0a. Para endpoints públicos como pesquisa
 * e reprodução, basta assinar o pedido com a Consumer Key/Secret da app
 * (não é preciso o fluxo de autorização de utilizador — "two-legged").
 * Implementa-se a assinatura HMAC-SHA1 à mão com o módulo "crypto" nativo
 * do Node — nenhuma dependência nova.
 *
 * Requer registo gratuito de uma app em https://audiomack.com/data-api/docs
 * e as variáveis de ambiente AUDIOMACK_API_KEY / AUDIOMACK_API_SECRET.
 * Sem estas, isAudiomackEnabled() devolve false e esta fonte é saltada
 * automaticamente (ver downloader.js) — nunca bloqueia o ".play".
 *
 * IMPORTANTE: usa exclusivamente o "streaming_url" temporário devolvido
 * pela própria API oficial (endpoint /music/:id/play) — não há scraping
 * nem contorno de DRM/proteções.
 */
import crypto from "crypto";

const API_BASE        = "https://api.audiomack.com/v1";
const CONSUMER_KEY     = process.env.AUDIOMACK_API_KEY    || null;
const CONSUMER_SECRET  = process.env.AUDIOMACK_API_SECRET || null;

export function isAudiomackEnabled() {
  return Boolean(CONSUMER_KEY && CONSUMER_SECRET);
}

function percentEncode(str) {
  return encodeURIComponent(str).replace(/[!*'()]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

/** Assina um pedido OAuth 1.0a (two-legged) e devolve o URL final com os parâmetros. */
function signedUrl(method, baseUrl, params = {}) {
  const oauthParams = {
    oauth_consumer_key:     CONSUMER_KEY,
    oauth_nonce:            crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp:        Math.floor(Date.now() / 1000).toString(),
    oauth_version:          "1.0",
  };

  const allParams = { ...params, ...oauthParams };
  const paramString = Object.keys(allParams).sort()
    .map(k => `${percentEncode(k)}=${percentEncode(String(allParams[k]))}`)
    .join("&");

  const baseString = [method.toUpperCase(), percentEncode(baseUrl), percentEncode(paramString)].join("&");
  const signingKey = `${percentEncode(CONSUMER_SECRET)}&`; // sem oauth_token_secret (two-legged)
  const signature  = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");

  const finalParams = { ...allParams, oauth_signature: signature };
  const qs = Object.keys(finalParams).map(k => `${percentEncode(k)}=${percentEncode(String(finalParams[k]))}`).join("&");
  return `${baseUrl}?${qs}`;
}

/**
 * Pesquisa uma faixa no Audiomack e devolve o melhor resultado (MediaInfo-like).
 * @param {string} query
 */
export async function searchAudiomack(query) {
  if (!isAudiomackEnabled()) {
    throw new Error("Audiomack não configurado (AUDIOMACK_API_KEY/AUDIOMACK_API_SECRET em falta)");
  }
  console.log(`[search] Audiomack: "${query}"`);

  const url = signedUrl("GET", `${API_BASE}/search`, { q: query, show: "songs", limit: "1" });
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });

  if (!res.ok) throw new Error(`Pesquisa Audiomack falhou (HTTP ${res.status})`);

  const data = await res.json();
  const item = (data?.results || [])[0];
  if (!item) throw new Error("Nenhum resultado no Audiomack");

  console.log(`[search] ✅ Audiomack: "${item.title}"`);

  return {
    platform:    "Audiomack",
    id:          item.id,
    title:       item.title  || "Sem título",
    url:         `https://audiomack.com/song/${item.uploader?.url_slug || item.url_slug || ""}/${item.url_slug || ""}`,
    duration:    0, // a API do Audiomack não expõe duração no objecto de música
    durationFmt: "?",
    thumbnail:   item.image  || null,
    uploader:    item.artist || item.uploader?.name || "Audiomack",
    views:       "?",
    viewCount:   0,
  };
}

/**
 * Obtém o URL de stream temporário oficial (endpoint /music/:id/play) e
 * descarrega-o para um Buffer. O streaming_url expira em segundos, por
 * isso é sempre pedido mesmo antes de descarregar.
 * @param {{id:number|string}} track — resultado de searchAudiomack()
 * @returns {Promise<Buffer>}
 */
export async function audiomackStreamBuffer(track) {
  const playUrl = signedUrl("POST", `${API_BASE}/music/${track.id}/play`, {});
  const playRes = await fetch(playUrl, { method: "POST", signal: AbortSignal.timeout(15_000) });

  if (!playRes.ok) throw new Error(`Audiomack: obtenção do stream falhou (HTTP ${playRes.status})`);

  let streamUrl = (await playRes.text()).trim();
  try { streamUrl = JSON.parse(streamUrl); } catch { /* já pode vir como string simples */ }

  if (!streamUrl || typeof streamUrl !== "string" || !streamUrl.startsWith("http")) {
    throw new Error("Audiomack: resposta sem streaming_url válido");
  }

  const audioRes = await fetch(streamUrl, { signal: AbortSignal.timeout(60_000) });
  if (!audioRes.ok) throw new Error(`Audiomack: download do stream falhou (HTTP ${audioRes.status})`);

  const buf = Buffer.from(await audioRes.arrayBuffer());
  if (buf.length < 1000) throw new Error("Audiomack: ficheiro de áudio vazio");

  return buf;
}
