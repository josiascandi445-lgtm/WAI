/**
 * Comando: .meme2
 * FIX: usa APIs dedicadas a memes em português/brasileiros.
 * A estratégia anterior de "substituir palavras inglesas" era fraca.
 *
 * APIs usadas (por ordem de tentativa):
 * 1. meme-api.com/gimme/me_irl          — subreddit brasileiro muito activo
 * 2. meme-api.com/gimme/Brasil          — subreddit Brasil
 * 3. meme-api.com/gimme/ProgramadorBR   — memes de programação em PT-BR
 * 4. Fallback local com memes em português
 */

const SUBREDDITS_PT = ["me_irl", "Brasil", "ProgramadorBR", "eu_nvr", "desabafos"];

const FALLBACK_PT = [
  { title: "Quando o professor diz 'vai cair na prova' e não cai 💀", url: "https://i.imgflip.com/1ur9b0.jpg" },
  { title: "Eu às 3h da manhã a pensar na vida em vez de dormir", url: "https://i.imgflip.com/30b1gx.jpg" },
  { title: "Programador quando o código funciona sem saber porquê", url: "https://i.imgflip.com/26am.jpg" },
  { title: "Segunda-feira chegando enquanto durmo no domingo", url: "https://i.imgflip.com/2wifvo.jpg" },
  { title: "Eu a dizer 'só mais 5 minutos' há 2 horas", url: "https://i.imgflip.com/1g8my4.jpg" },
];

export default {
  name: "meme2",
  description: "Meme em português (subreddits brasileiros)",

  async execute({ sock, jid, msg }) {
    // Tenta subreddits PT aleatórios
    const subreddit = SUBREDDITS_PT[Math.floor(Math.random() * SUBREDDITS_PT.length)];

    try {
      const res = await fetch(`https://meme-api.com/gimme/${subreddit}`, {
        signal: AbortSignal.timeout(8_000)
      });

      if (!res.ok) throw new Error(`API retornou ${res.status}`);

      const data = await res.json();

      // Filtra conteúdo NSFW
      if (data.nsfw) throw new Error("NSFW - a tentar outro");
      if (!data?.url) throw new Error("Sem URL");

      // Verifica se é imagem (não vídeo/gif pesado)
      const url = data.url;
      if (url.endsWith(".mp4") || url.endsWith(".gifv")) throw new Error("É vídeo, não imagem");

      await sock.sendMessage(jid, {
        image: { url },
        caption: `😂 ${data.title || "Meme"}\n📌 r/${subreddit}`
      }, { quoted: msg });

    } catch (err) {
      console.error(`[meme2] Falhou (${err.message}), usando fallback PT`);

      // Fallback garantido em português
      const meme = FALLBACK_PT[Math.floor(Math.random() * FALLBACK_PT.length)];
      await sock.sendMessage(jid, {
        image: { url: meme.url },
        caption: `😂 ${meme.title}`
      }, { quoted: msg });
    }
  }
};
