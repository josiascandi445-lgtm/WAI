/**
 * commands/spotify.js
 *
 * O Spotify não tem API oficial de download (só preview de 30s). A
 * abordagem correcta e legal: lemos o TÍTULO da faixa através do oEmbed
 * público oficial (open.spotify.com/oembed — sem chave, sem auth) e
 * reencaminhamos essa pesquisa para o MESMO pipeline de áudio já usado
 * pelo ".play" (SoundCloud → Audiomack → YouTube) — zero duplicação de
 * lógica de download.
 *
 * LIMITAÇÃO CONHECIDA (documentada honestamente): o oEmbed do Spotify só
 * devolve o título da faixa, não o artista separadamente. Para a maioria
 * das músicas isto é suficiente para encontrar o resultado certo, mas em
 * títulos muito genéricos ("Sky", "Home"...) o resultado pode não ser
 * exactamente a mesma versão/artista do link do Spotify.
 *
 * Uso:
 *   .spotify <link de uma faixa do open.spotify.com>
 */
import { downloadAndSendAudio } from "../lib/media/downloader.js";

const TRACK_URL_RE = /open\.spotify\.com\/(?:intl-[a-z]{2}\/)?track\/[A-Za-z0-9]+|spotify\.link\/[A-Za-z0-9]+/i;

/** Busca o título da faixa via oEmbed oficial do Spotify. Sem chave/auth. */
export async function fetchSpotifyTitle(trackUrl) {
  const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(trackUrl)}`;
  const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(15_000) });

  if (!res.ok) throw new Error(`oEmbed do Spotify falhou (HTTP ${res.status}) — link inválido ou faixa privada`);

  const data = await res.json();
  if (!data?.title) throw new Error("oEmbed do Spotify não devolveu título");

  return data.title;
}

export default {
  name: "spotify",
  description: "Descarrega o áudio de uma faixa do Spotify (.spotify <link>)",

  async execute({ sock, jid, msg, args }) {
    const input = args.join(" ").trim();

    if (!input) {
      return sock.sendMessage(jid, {
        text: "❌ Uso: .spotify <link da faixa>\n\nExemplo:\n• .spotify https://open.spotify.com/track/...",
      }, { quoted: msg });
    }

    if (!TRACK_URL_RE.test(input)) {
      return sock.sendMessage(jid, {
        text:
          "❌ Isso não parece um link de faixa do Spotify.\n" +
          "Suporto apenas links de *faixa* (open.spotify.com/track/...).\n" +
          "Para pesquisar por nome, usa .play <nome da música>.",
      }, { quoted: msg });
    }

    let title;
    try {
      console.log(`[spotify] a resolver título de: ${input}`);
      title = await fetchSpotifyTitle(input);
      console.log(`[spotify] título resolvido: "${title}" — a encaminhar para o pipeline de áudio`);
    } catch (err) {
      console.error(`[spotify] ❌ erro ao resolver oEmbed: ${err.message}`);
      return sock.sendMessage(jid, {
        text: `❌ Não consegui identificar essa faixa do Spotify.\n\n${err.message}`,
      }, { quoted: msg });
    }

    // A partir daqui reutiliza EXACTAMENTE o mesmo fluxo do ".play <nome>"
    // (SoundCloud → Audiomack → YouTube) — downloadAndSendAudio trata o
    // título como qualquer pesquisa de texto normal.
    await downloadAndSendAudio({ sock, jid, msg }, title);
  },
};
