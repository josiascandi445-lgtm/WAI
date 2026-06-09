export default {
  name: "joke",

  async execute({ sock, jid, msg }) {
    const res = await fetch("https://official-joke-api.appspot.com/random_joke");
    const data = await res.json();

    await sock.sendMessage(jid, {
      text: `${data.setup}\n\n😂 ${data.punchline}`
    }, { quoted: msg });
  }
};
