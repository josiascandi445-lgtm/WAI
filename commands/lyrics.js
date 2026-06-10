export default {
  name: "lyrics",
  description: "Busca letras",

  async execute({ sock, jid, msg, args }) {
    if (args.length < 2) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .lyrics artista musica"
      }, { quoted: msg });
    }

    const [artist, ...songArr] = args;
    const song = songArr.join(" ");

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
        text: "❌ não encontrei a letra"
      }, { quoted: msg });
    }
  }
};
