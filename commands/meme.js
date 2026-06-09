export default {
  name: "meme",

  async execute({ sock, jid, msg }) {
    const res = await fetch("https://meme-api.com/gimme");
    const data = await res.json();

    await sock.sendMessage(jid, {
      image: { url: data.url },
      caption: data.title
    }, { quoted: msg });
  }
};
