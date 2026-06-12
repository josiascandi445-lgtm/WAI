/**
 * Comando: .piada
 * Piadas em português de uma API PT + fallback local.
 */
const FALLBACK = [
  "Por que o livro de matemática foi ao psicólogo?\nPorque tinha muitos problemas! 😂",
  "O que o zero disse para o oito?\nBonito cinto! 😄",
  "Por que o computador foi ao médico?\nPorque tinha vírus! 💻😷",
  "Qual é o animal mais antigo?\nA zebra — ainda está a preto e branco! 🦓",
  "Por que os polvos nunca se perdem?\nPorque têm GPS — oito braços de precisão! 🐙",
  "O que o mar disse para a praia?\nNada, só acenou! 🌊",
  "Por que o livro foi à escola?\nPara ser bem lido! 📚",
  "Qual é o cumprimento mais curto?\nOi! Qual é o mais comprido?\nOi lá vai mais um! 😂",
  "Por que os fantasmas são maus mentirosos?\nPorque se vê logo através deles! 👻",
  "O que é que um semáforo diz para outro?\nNão olhes, estou a mudar! 🚦",
];

export default {
  name: "piada",
  aliases: ["joke3", "humor"],
  description: "Conta uma piada em português",

  async execute({ sock, jid, msg }) {
    try {
      // API de piadas em português
      const res = await fetch("https://v2.jokeapi.dev/joke/Any?lang=pt&blacklistFlags=nsfw,racist,sexist&type=twopart", {
        signal: AbortSignal.timeout(6_000)
      });

      if (!res.ok) throw new Error("API falhou");
      const data = await res.json();

      if (data.error || !data.setup) throw new Error("Sem piada");

      await sock.sendMessage(jid, {
        text: `😂 *${data.setup}*\n\n🎤 ${data.delivery}`
      }, { quoted: msg });

    } catch {
      // Fallback local
      const piada = FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
      await sock.sendMessage(jid, { text: `😂 ${piada}` }, { quoted: msg });
    }
  }
};
