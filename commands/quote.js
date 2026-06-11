/**
 * Comando: .quote
 * Envia uma citação motivacional aleatória.
 */
const FALLBACK = [
  { content: "O sucesso é a soma de pequenos esforços repetidos dia após dia.", author: "Robert Collier" },
  { content: "Não é o mais forte que sobrevive, mas o mais adaptável.", author: "Charles Darwin" },
  { content: "A persistência é o caminho do êxito.", author: "Charlie Chaplin" },
  { content: "O único lugar onde o sucesso vem antes do trabalho é no dicionário.", author: "Vidal Sassoon" },
];

export default {
  name: "quote",
  aliases: ["citacao", "frase"],
  description: "Envia uma citação motivacional",

  async execute({ sock, jid, msg }) {
    try {
      const res = await fetch("https://zenquotes.io/api/random");
      if (!res.ok) throw new Error("API falhou");

      const [data] = await res.json();
      if (!data?.q) throw new Error("Sem conteúdo");

      await sock.sendMessage(jid, {
        text: `💬 _"${data.q}"_\n\n— *${data.a}*`
      }, { quoted: msg });

    } catch {
      const q = FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
      await sock.sendMessage(jid, {
        text: `💬 _"${q.content}"_\n\n— *${q.author}*`
      }, { quoted: msg });
    }
  }
};
