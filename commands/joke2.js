export default {
  name: "joke2",
  description: "Piadas em português (API estável)",

  async execute({ sock, jid, msg }) {

    try {
      // 🇵🇹 tenta português primeiro
      const res = await fetch("https://v2.jokeapi.dev/joke/Any?lang=pt&type=twopart");

      const data = await res.json();

      // ❌ fallback se API não entregar português real
      if (!data || data.error) {
        throw new Error("API falhou");
      }

      let jokeText;

      if (data.type === "single") {
        jokeText = `😂 ${data.joke}`;
      } else {
        jokeText = `😂 ${data.setup}\n\n😏 ${data.delivery}`;
      }

      await sock.sendMessage(jid, {
        text: jokeText
      }, { quoted: msg });

    } catch (err) {
      console.log("joke2 error:", err);

      // 🔥 fallback local (NUNCA falha)
      const fallback = [
        "😂 Porque é que o programador foi ao médico? Porque tinha bugs na cabeça.",
        "😂 Eu não procrastino… eu faço decisões estratégicas de última hora.",
        "😂 A vida é como código… se funciona, não mexas. Se não funciona, culpa o JavaScript."
      ];

      const joke = fallback[Math.floor(Math.random() * fallback.length)];

      await sock.sendMessage(jid, {
        text: joke
      }, { quoted: msg });
    }
  }
};
