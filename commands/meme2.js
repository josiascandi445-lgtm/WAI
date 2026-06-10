export default {
  name: "meme2",
  description: "Memes em português (versão estável)",

  async execute({ sock, jid, msg }) {

    const subreddits = [
      "memesbr",
      "brasil",
      "PORTUGALCARALHO"
    ];

    try {
      const randomSub = subreddits[Math.floor(Math.random() * subreddits.length)];

      const res = await fetch(
        `https://www.reddit.com/r/${randomSub}/hot.json?limit=50`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0"
          }
        }
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();

      const posts = json?.data?.children
        ?.map(p => p.data)
        ?.filter(p =>
          !p.over_18 &&
          p.url &&
          (
            p.url.endsWith(".jpg") ||
            p.url.endsWith(".png") ||
            p.url.endsWith(".jpeg") ||
            p.url.includes("i.redd.it") ||
            p.url.includes("imgur")
          )
        ) || [];

      if (!posts.length) {
        return sock.sendMessage(jid, {
          text: "❌ Não encontrei memes agora. tenta outra vez"
        }, { quoted: msg });
      }

      const meme = posts[Math.floor(Math.random() * posts.length)];

      await sock.sendMessage(jid, {
        image: { url: meme.url },
        caption: `😂 ${meme.title}`
      }, { quoted: msg });

    } catch (err) {
      console.log("meme2 error:", err);

      await sock.sendMessage(jid, {
        text: "💥 falha ao buscar memes PT (Reddit não colaborou)"
      }, { quoted: msg });
    }
  }
};
