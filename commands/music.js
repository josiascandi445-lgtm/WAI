export default {
  name: "music",

  async execute({ sock, jid, msg, args }) {

    await sock.sendMessage(jid, {
      text: "🎧 .music chegou aqui"
    }, { quoted: msg });

  }
};
