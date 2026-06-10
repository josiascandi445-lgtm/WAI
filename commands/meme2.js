const fallback = [
  { title: "Quando o Wi-Fi cai e tu começas a viver como em 1998", url: "https://i.imgflip.com/1ur9b0.jpg" },
  { title: "Eu a estudar 5 minutos antes do teste", url: "https://i.imgflip.com/30b1gx.jpg" },
  { title: "Programador a dizer 'já vai funcionar'", url: "https://i.imgflip.com/26am.jpg" }
];

export default {
  name: "meme2",

  async execute({ sock, jid, msg }) {

    try {
      const res = await fetch("https://meme-api.com/gimme");
      const data = await res.json();

      let title = data.title || "";

      // tenta “traduzir” de forma simples (não IA)
      title = title
        .replace(/dog/gi, "cão")
        .replace(/cat/gi, "gato")
        .replace(/you/gi, "tu");

      await sock.sendMessage(jid, {
        image: { url: data.url },
        caption: `😂 ${title}`
      }, { quoted: msg });

    } catch (err) {
      const meme = fallback[Math.floor(Math.random() * fallback.length)];

      await sock.sendMessage(jid, {
        image: { url: meme.url },
        caption: `😂 ${meme.title}`
      }, { quoted: msg });
    }
  }
};
