export default {
  name: "define",
  description: "Define uma palavra (apenas inglês)",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .define <palavra em inglês>\nExemplo: .define serendipity"
      }, { quoted: msg });
    }

    const word = args[0].toLowerCase().replace(/[^a-z]/g, "");

    if (!word) {
      return sock.sendMessage(jid, {
        text: "❌ Palavra inválida. O dicionário suporta apenas inglês."
      }, { quoted: msg });
    }

    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);

      if (res.status === 404) {
        return sock.sendMessage(jid, {
          text: `❌ Palavra *${word}* não encontrada.\n⚠️ Este dicionário é apenas em inglês.`
        }, { quoted: msg });
      }

      if (!res.ok) throw new Error(`API retornou ${res.status}`);

      const data = await res.json();
      const entry = data[0];
      const meaning = entry?.meanings?.[0];
      const def = meaning?.definitions?.[0];

      if (!def) throw new Error("Sem definição");

      let text = `📖 *${entry.word}*`;
      if (entry.phonetic) text += ` _(${entry.phonetic})_`;
      text += `\n📝 ${meaning.partOfSpeech}\n\n${def.definition}`;
      if (def.example) text += `\n\n💬 Exemplo: _${def.example}_`;

      await sock.sendMessage(jid, { text }, { quoted: msg });

    } catch (err) {
      console.error("[define] erro:", err.message);
      await sock.sendMessage(jid, {
        text: "⚠️ Erro ao procurar definição. Lembra-te: apenas palavras em inglês."
      }, { quoted: msg });
    }
  }
};
