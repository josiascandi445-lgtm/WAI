/**
 * commands/tiktok.js
 *
 * Comando: .tiktok / .tk
 *
 * - Se o argumento for um link do TikTok → download directo (comportamento
 *   já existente, inalterado).
 * - Se não for um link → trata como pesquisa: encontra o primeiro vídeo
 *   relevante no TikTok (via searchTikTok, já existente em lib/media/search.js,
 *   API tikwm) e reencaminha o link resultante para o MESMO fluxo de
 *   download (downloadAndSendVideo) — zero duplicação de lógica de download.
 *
 * Exemplos suportados:
 *   .tiktok https://vm.tiktok.com/...    → link directo
 *   .tiktok edit toji                    → pesquisa
 *   .tiktok funny cats                   → pesquisa
 */
import { downloadAndSendVideo } from "../lib/media/downloader.js";
import { isUrl } from "../lib/media/platformDetector.js";
import { searchTikTok } from "../lib/media/search.js";

function isTikTokUrl(str) {
  return /tiktok\.com|vm\.tiktok|vt\.tiktok/i.test(str);
}

export default {
  name: "tiktok",
  aliases: ["tk"],
  description: "Descarrega vídeo do TikTok (.tiktok <link ou nome>)",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text:
          "❌ Uso: .tiktok <link ou nome>\n\n" +
          "Exemplos:\n" +
          "• .tiktok https://www.tiktok.com/@user/video/123\n" +
          "• .tiktok edit toji\n" +
          "• .tiktok funny cats",
      }, { quoted: msg });
    }

    const input = args.join(" ").trim();
    const ctx = { sock, jid, msg };

    // Caso 1: já é um link do TikTok → comportamento actual, inalterado.
    if (isUrl(input)) {
      if (!isTikTokUrl(input)) {
        return sock.sendMessage(jid, {
          text:
            "❌ Esse link não parece ser do TikTok.\n" +
            "Para outras plataformas usa .video ou .dl.",
        }, { quoted: msg });
      }
      return downloadAndSendVideo(ctx, input);
    }

    // Caso 2: não é link → trata como pesquisa por nome.
    let statusMsg;
    try {
      statusMsg = await sock.sendMessage(jid, { text: "🔎 *Procurando no TikTok...*" }, { quoted: msg });
    } catch {}

    let found;
    try {
      found = await searchTikTok(input);
    } catch (err) {
      console.error(`[tiktok] ❌ Pesquisa falhou: ${err.message}`);
      const text = `❌ *Não encontrei nenhum vídeo no TikTok para:* "${input}"\n\n${err.message}`;
      if (statusMsg) {
        try { return await sock.sendMessage(jid, { text, edit: statusMsg.key }); } catch {}
      }
      return sock.sendMessage(jid, { text }, { quoted: msg });
    }

    // Vídeo encontrado — a partir daqui reutiliza EXACTAMENTE o mesmo fluxo
    // de download usado para um link directo (downloadAndSendVideo trata
    // o URL encontrado como qualquer outro link do TikTok).
    await downloadAndSendVideo(ctx, found.url);
  },
};
    
