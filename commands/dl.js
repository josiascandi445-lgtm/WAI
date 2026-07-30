/**
 * commands/dl.js
 * Comando universal — detecta automaticamente se deve descarregar
 * áudio ou vídeo com base nas flags ou no contexto.
 *
 * .dl <link ou nome>          → vídeo por defeito
 * .dl --audio <link ou nome>  → força áudio
 * .dl --video <link ou nome>  → força vídeo
 */
import { downloadAndSendAudio, downloadAndSendVideo } from "../lib/media/downloader.js";

export default {
  name: "dl",
  aliases: ["download"],
  description: "Download universal de média (.dl link ou nome)",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text:
          "❌ Uso: .dl <link ou nome>\n\n" +
          "Exemplos:\n" +
          "• .dl https://youtu.be/...\n" +
          "• .dl Minecraft Trailer\n" +
          "• .dl --audio Shape of You\n" +
          "• .dl --video Alan Walker Faded",
      }, { quoted: msg });
    }

    // Detecta flag de modo
    let mode  = "video"; // por defeito
    let input = args.join(" ");

    if (args[0] === "--audio") {
      mode  = "audio";
      input = args.slice(1).join(" ");
    } else if (args[0] === "--video") {
      mode  = "video";
      input = args.slice(1).join(" ");
    }

    if (!input.trim()) {
      return sock.sendMessage(jid, {
        text: "❌ Indica o nome ou link após a flag.",
      }, { quoted: msg });
    }

    if (mode === "audio") {
      await downloadAndSendAudio({ sock, jid, msg }, input);
    } else {
      await downloadAndSendVideo({ sock, jid, msg }, input);
    }
  },
};
