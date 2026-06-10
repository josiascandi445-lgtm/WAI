export default {
  name: "joke2",
  description: "Piadas em português (versão estável)",

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
          (p.selftext || p.title)
        ) || [];

      if (!posts.length) {
        return sock.sendMessage(jid, {
          text: "❌ Não encontrei piadas em português agora. tenta outra vez."
        }, { quoted: msg });
      }

      const joke = posts[Math.floor(Math.random() * posts.length)];

      const text =
`😂 ${joke.title}

${joke.selftext || "😐 (sem texto, só humor visual)"}`;

      await sock.sendMessage(jid, {
        text
      }, { quoted: msg });

    } catch (err) {
      console.log("joke2 error:", err);

      await sock.sendMessage(jid, {
        text: "💥 falha ao buscar piadas PT (Reddit bloqueou ou falhou)"
      }, { quoted: msg });
    }
  }
};
