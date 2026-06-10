const jokesPT = [
  "Porque o computador foi ao médico? Porque apanhou um vírus.",
  "O que o zero disse ao oito? Belo cinto!",
  "Qual é o cúmulo da rapidez? Fechar a gaveta e prender a gravata.",
  "Porque o livro de matemática estava triste? Porque tinha muitos problemas.",
  "O que o tomate foi fazer ao banco? Tirar extrato.",
  "Qual é o animal mais antigo? A zebra, porque está a preto e branco.",
  "O que um tijolo disse ao outro? Há um cimento entre nós.",
  "Porque o café foi à polícia? Porque foi roubado."
];

const joke = jokesPT[Math.floor(Math.random() * jokesPT.length)];

await sock.sendMessage(from, {
  text: `😂 *Piada do Dia*\n\n${joke}`
});
