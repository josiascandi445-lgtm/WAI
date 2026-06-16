/**
 * Comando: .spotify / .spot
 * O Spotify protege as faixas com DRM — não existe forma legal de
 * descarregar o ficheiro directamente da plataforma. A abordagem padrão
 * (usada por bots legítimos) é localizar a mesma faixa no YouTube,
 * que é uma fonte de áudio aberta, e descarregar de lá.
 */
import { spotifySearch, downloadAudio } from "../lib/ytdlp.js";

function fmt(s) {
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default {
  name: "spotify",
  aliases: ["spot"],
  description: "Procura e envia uma música (via YouTube, mesma faixa do Spotify)",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .spotify nome da música\nEx: .spotify Shiloh Dinasty Novacaine"
      }, { quoted: msg });
    }

    const query = args.join(" ");
    await sock.sendMessage(jid, { text: `🔎 A procurar: *${query}*...` }, { quoted: msg });

    try {
      const track = await spotifySearch(query);

      if (track.duration > 720) {
        return sock.sendMessage(jid, {
          text: `⚠️ Faixa demasiado longa (${fmt(track.duration)}). Máximo: 12 minutos.`
        }, { quoted: msg });
      }

      const preview = `🎧 *${track.title}*\n👤 ${track.uploader}\n⏱️ ${fmt(track.duration)}\n\n⬇️ A descarregar...`;
      if (track.thumbnail) {
        await sock.sendMessage(jid, { image: { url: track.thumbnail }, caption: preview }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text: preview }, { quoted: msg });
      }

      const buffer = await downloadAudio(track.url);

      const sizeMB = buffer.length / (1024 * 1024);
      if (sizeMB > 16) {
        return sock.sendMessage(jid, {
          text: `⚠️ Ficheiro demasiado grande (${sizeMB.toFixed(1)}MB).`
        }, { quoted: msg });
      }

      await sock.sendMessage(jid, {
        audio: buffer,
        mimetype: "audio/mpeg",
        fileName: `${track.title.replace(/[^\w\s]/gi, "")}.mp3`,
      }, { quoted: msg });

    } catch (err) {
      console.error("[spotify] erro:", err.message);
      let m = "⚠️ Não consegui encontrar ou descarregar esta música.";
      if (err.message?.includes("timeout")) m = "⏱️ O download demorou demasiado. Tenta novamente.";
      await sock.sendMessage(jid, { text: m }, { quoted: msg });
    }
  }
};
