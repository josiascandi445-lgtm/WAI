export default {
  name: "joke2",
  description: "Envia piadas em português",

  async execute({ sock, jid, msg }) {

    const subreddits = [
      "piadas",
      "portugalcaralho",
      "memesbr"
    ];

    const randomSub = subreddits[Math.floor(Math.random() * subreddits.length)];

    try {
      const res = await fetch(`https://www.reddit.com/r/${randomSub}/hot.json?limit=25`);
      const json = await res.json();

      const posts = json.data.children
        .map(p => p.data)
        .filter(p =>
          !p.over_18 &&
          p.selftext &&
          p.selftext.length < 400
        );

      if (!posts.length) {
        return sock.sendMessage(jid, {
          text: "❌ Não encontrei piadas agora."
        }, { quoted: msg });
      }

      const joke = posts[Math.floor(Math.random() * posts.length)];

      await sock.sendMessage(jid, {
        text: `😂 ${joke.title}\n\n${joke.selftext}`
      }, { quoted: msg });

    } catch (err) {
      console.log("joke2 error:", err);

      await sock.sendMessage(jid, {
        text: "💥 Erro ao buscar piadas em português"
      }, { quoted: msg });
    }
  }
};
