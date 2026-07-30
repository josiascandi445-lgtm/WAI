/**
 * commands/tiktok.js
 *
 * Comando: .tiktok / .tk
 * Descarrega e envia vídeo do TikTok — APENAS por link (sem pesquisa por nome,
 * como pedido). Toda a lógica de download vive em lib/media/downloader.js —
 * este ficheiro é apenas um wrapper fino, igual em espírito a video.js/dl.js,
 * para que exista um comando dedicado e óbvio para TikTok.
 *
 * Antes desta correcção este ficheiro importava um módulo/funções que não
 * existiam (../lib/ytdlp.js, tiktokSearch, downloadTikTok) — por isso o
 * comando nunca chegava sequer a carregar (o loader engolia o erro em
 * silêncio). Agora usa o mesmo motor (yt-dlp) já usado por .video/.dl.
 */
import { downloadAndSendVideo } from "../lib/media/downloader.js";
import { isUrl, detectPlatform } from "../lib/media/platformDetector.js";

function isTikTokUrl(str) {
  return /tiktok\.com|vm\.tiktok|vt\.tiktok/i.test(str);
}

export default {
  name: "tiktok",
  aliases: ["tk"],
  description: "Descarrega vídeo do TikTok (.tiktok <link> ou .tk <link>)",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Uso: .tiktok <link>\n\nExemplo:\n• .tiktok https://www.tiktok.com/@user/video/123",
      }, { quoted: msg });
    }

    const input = args.join(" ").trim();

    if (!isUrl(input) || !isTikTokUrl(input)) {
      return sock.sendMessage(jid, {
        text:
          "❌ Isso não parece um link do TikTok.\n\n" +
          "O *.tiktok* só aceita links diretos (sem pesquisa por nome).\n" +
          "Exemplo: .tiktok https://www.tiktok.com/@user/video/123",
      }, { quoted: msg });
    }

    await downloadAndSendVideo({ sock, jid, msg }, input);
  },
};
