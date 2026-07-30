/**
 * commands/play.js
 * Download de áudio — aceita link ou nome.
 * Toda a lógica está em lib/media/downloader.js
 */
import { downloadAndSendAudio } from "../lib/media/downloader.js";

export default {
  name: "play",
  aliases: ["music", "ytmp3"],
  description: "Descarrega e envia áudio (.play nome ou link)",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text:
          "❌ Uso: .play <nome ou link>\n\n" +
          "Exemplos:\n" +
          "• .play Believer Imagine Dragons\n" +
          "• .play https://youtu.be/...\n" +
          "• .play https://www.tiktok.com/...",
      }, { quoted: msg });
    }

    const input = args.join(" ");
    await downloadAndSendAudio({ sock, jid, msg }, input);
  },
};
