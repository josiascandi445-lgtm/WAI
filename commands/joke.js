/**
 * Comando: .joke
 * FIX P5: adicionado try/catch + fallback local.
 */
const FALLBACK_JOKES = [
  { setup: "Why do programmers prefer dark mode?", punchline: "Because light attracts bugs!" },
  { setup: "How many programmers does it take to change a lightbulb?", punchline: "None. That's a hardware problem." },
  { setup: "Why was the JavaScript developer sad?", punchline: "Because he didn't Node how to Express himself." },
];

export default {
  name: "joke",
  description: "Conta uma piada em inglês",

  async execute({ sock, jid, msg }) {
    try {
      const res = await fetch("https://official-joke-api.appspot.com/random_joke");

      if (!res.ok) throw new Error(`API retornou ${res.status}`);

      const data = await res.json();

      if (!data?.setup) throw new Error("Resposta inválida");

      await sock.sendMessage(jid, {
        text: `😂 *${data.setup}*\n\n🎤 ${data.punchline}`
      }, { quoted: msg });

    } catch (err) {
      console.error("[joke] API falhou, usando fallback:", err.message);

      const joke = FALLBACK_JOKES[Math.floor(Math.random() * FALLBACK_JOKES.length)];
      await sock.sendMessage(jid, {
        text: `😂 *${joke.setup}*\n\n🎤 ${joke.punchline}`
      }, { quoted: msg });
    }
  }
};
