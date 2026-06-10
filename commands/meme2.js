const fallbackMemes = [
  {
    title: "Quando o professor diz 'isto não cai' e cai mesmo",
    url: "https://i.imgflip.com/1ur9b0.jpg"
  },
  {
    title: "Eu a dizer 'vou dormir cedo' às 3:47",
    url: "https://i.imgflip.com/30b1gx.jpg"
  },
  {
    title: "Programador: já funciona | realidade: não funciona",
    url: "https://i.imgflip.com/26am.jpg"
  }
];

export default {
  name: "meme2",

  async execute({ sock, jid, msg }) {

    try {
      const res = await fetch("https://meme-api.com/gimme");
      const data = await res.json();

      if (!data?.url) throw new Error("no meme");

      let title = data.title || "";

      // 🧠 tentativa simples de “portuguesar”
      const ptFix = [
        ["you", "tu"],
        ["your", "teu"],
        ["dog", "cão"],
        ["cat", "gato"],
        ["school", "escola"],
        ["teacher", "professor"]
      ];

      ptFix.forEach(([en, pt]) => {
        title = title.replace(new RegExp(en, "gi"), pt);
      });

      await sock.sendMessage(jid, {
        image: { url: data.url },
        caption: `😂 ${title}`
      }, { quoted: msg });

    } catch (err) {
      const meme = fallbackMemes[Math.floor(Math.random() * fallbackMemes.length)];

      await sock.sendMessage(jid, {
        image: { url: meme.url },
        caption: `😂 ${meme.title}`
      }, { quoted: msg });
    }
  }
};
