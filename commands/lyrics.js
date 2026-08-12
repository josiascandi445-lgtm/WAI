/**
 * Comando: .lyrics
 * Uso: .lyrics <música>  (ex: .lyrics believer, ou .lyrics imagine dragons believer)
 *
 * CAUSA DO BUG ANTERIOR: exigia rigidamente "primeira palavra = artista,
 * resto = música". Quem escrevesse só o nome da música (sem artista) —
 * o uso mais natural — enviava um pedido incompleto que falhava sempre.
 *
 * FIX: usa primeiro o endpoint /suggest/ da própria API (pesquisa difusa,
 * devolve artista+título mais prováveis a partir de texto livre) e só
 * depois pede a letra com o artista/título corretos. Continua a aceitar
 * "artista música" explícito, mas já não obriga a isso.
 */
export default {
  name: "lyrics",
  description: "Letra de uma música (.lyrics <música> ou .lyrics <artista> <música>)",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .lyrics <música>\nEx: .lyrics believer"
      }, { quoted: msg });
    }

    const query = args.join(" ");

    try {
      let artist, song;

      // 1. Pesquisa difusa — encontra o artista/título mais prováveis.
      const suggestRes = await fetch(`https://api.lyrics.ovh/suggest/${encodeURIComponent(query)}`, {
        signal: AbortSignal.timeout(10_000),
      });

      if (suggestRes.ok) {
        const suggestData = await suggestRes.json();
        const best = suggestData?.data?.[0];
        if (best?.artist?.name && best?.title) {
          artist = best.artist.name;
          song = best.title;
        }
      }

      // 2. Sem sugestão -> assume "primeira palavra = artista, resto = música" (uso explícito antigo).
      if (!artist || !song) {
        const wordsCopy = [...args];
        artist = wordsCopy.shift();
        song = wordsCopy.join(" ");
      }

      if (!song) throw new Error("Não identifiquei música/artista");

      const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(song)}`, {
        signal: AbortSignal.timeout(10_000),
      });

      const data = await res.json();
      if (!data?.lyrics) throw new Error("Sem letra disponível");

      await sock.sendMessage(jid, {
        text: `🎧 *${artist} - ${song}*\n\n${data.lyrics}`
      }, { quoted: msg });

    } catch (err) {
      console.error("[lyrics] erro:", err.message);
      await sock.sendMessage(jid, {
        text: "❌ Não encontrei essa letra. Tenta com o nome do artista também: .lyrics <artista> <música>"
      }, { quoted: msg });
    }
  }
};
