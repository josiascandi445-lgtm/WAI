/**
 * commands/video.js
 * Download de vídeo — aceita link ou nome.
 * Toda a lógica está em lib/media/downloader.js
 */
import { downloadAndSendVideo } from "../lib/media/downloader.js";

export default {
  name: "video",
  aliases: ["ytmp4"],
  description: "Descarrega e envia vídeo (.video nome ou link)",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text:
          "❌ Uso: .video <nome ou link>\n\n" +
          "Exemplos:\n" +
          "• .video GTA 6 Trailer\n" +
          "• .video https://youtu.be/...\n" +
          "• .video https://www.instagram.com/...",
      }, { quoted: msg });
    }

    const input = args.join(" ");
    await downloadAndSendVideo({ sock, jid, msg }, input);
  },
};
