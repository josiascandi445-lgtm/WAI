export default {
  name: "lyrics",

  async execute({ sock, jid, msg, args }) {
    if (args.length < 2) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .lyrics artista música"
      }, { quoted: msg });
    }

    const artist = args.shift();
    const song = args.join(" ");

    try {
      const res = await fetch(
        `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(song)}`
      );

      const data = await res.json();

      if (!data.lyrics) throw new Error();

      await sock.sendMessage(jid, {
        text: `🎧 ${artist} - ${song}\n\n${data.lyrics}`
      }, { quoted: msg });

    } catch (err) {
      await sock.sendMessage(jid, {
        text: "❌ não encontrei essa letra (tenta outro nome ou artista)"
      }, { quoted: msg });
    }
  }
};
