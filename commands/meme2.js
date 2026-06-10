const memesPT = [
  {
    image: "https://i.imgur.com/abc123.jpg",
    caption: "Quando o professor diz que o trabalho é em grupo e tu fazes tudo sozinho."
  },
  {
    image: "https://i.imgur.com/def456.jpg",
    caption: "Eu a estudar 5 minutos antes da prova."
  },
  {
    image: "https://i.imgur.com/ghi789.jpg",
    caption: "Quando o salário entra e as contas já estão à espera."
  }
];

const meme = memesPT[Math.floor(Math.random() * memesPT.length)];

await sock.sendMessage(from, {
  image: { url: meme.image },
  caption: `🤣 *Meme PT*\n\n${meme.caption}`
});
