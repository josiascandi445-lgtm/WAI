export default {
  name: "meme2",
  description: "Memes em português (estável)",

  async execute({ sock, jid, msg }) {

    try {
      // 🧠 1. tenta meme API (estável)
      const res = await fetch("https://meme-api.com/gimme");
      const data = await res.json();

      if (!data || !data.url) {
        throw new Error("API falhou");
      }

      await sock.sendMessage(jid, {
        image: { url: data.url },
        caption: `😂 ${data.title || "Meme"}`
      }, { quoted: msg });

    } catch (err) {
      console.log("meme2 error:", err);

      // 💀 fallback em português (NUNCA falha)
      const fallbackMemes = [
        {
          title: "Quando o Wi-Fi cai e tu percebes que tens família",
          url: "https://i.imgflip.com/1ur9b0.jpg"
        },
        {
          title: "Eu a dizer 'vou dormir cedo' às 3:47 da manhã",
          url: "https://i.imgflip.com/30b1gx.jpg"
        },
        {
          title: "Programador a dizer 'já vai funcionar' (mentiu)",
          url: "https://i.imgflip.com/26am.jpg"
        }
      ];

      const meme = fallbackMemes[Math.floor(Math.random() * fallbackMemes.length)];

      await sock.sendMessage(jid, {
        image: { url: meme.url },
        caption: `😂 ${meme.title}`
      }, { quoted: msg });
    }
  }
};
