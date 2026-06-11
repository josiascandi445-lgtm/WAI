/**
 * Comando: .meme
 * FIX P5: adicionado try/catch + fallback local.
 */
const FALLBACK_MEMES = [
  { title: "Quando o código funciona na primeira tentativa", url: "https://i.imgflip.com/1ur9b0.jpg" },
  { title: "Eu às 3h da manhã a fazer debug", url: "https://i.imgflip.com/30b1gx.jpg" },
  { title: "Git push --force num sexta-feira", url: "https://i.imgflip.com/26am.jpg" },
];

export default {
  name: "meme",
  description: "Envia um meme aleatório",

  async execute({ sock, jid, msg }) {
    try {
      const res = await fetch("https://meme-api.com/gimme");

      if (!res.ok) throw new Error(`API retornou ${res.status}`);

      const data = await res.json();

      if (!data?.url) throw new Error("Sem URL no resultado");

      await sock.sendMessage(jid, {
        image: { url: data.url },
        caption: `😂 ${data.title || "Meme"}`
      }, { quoted: msg });

    } catch (err) {
      console.error("[meme] API falhou, usando fallback:", err.message);

      // Fallback local — nunca falha
      const meme = FALLBACK_MEMES[Math.floor(Math.random() * FALLBACK_MEMES.length)];
      await sock.sendMessage(jid, {
        image: { url: meme.url },
        caption: `😂 ${meme.title}`
      }, { quoted: msg });
    }
  }
};
