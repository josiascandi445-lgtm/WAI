/**
 * commands/imggen.js
 *
 * Gera uma imagem a partir de um prompt de texto usando a API pública
 * e gratuita da Pollinations.ai (https://pollinations.ai) — sem chave,
 * sem registo. O endpoint devolve a imagem directamente no corpo da
 * resposta HTTP (image/jpeg).
 *
 * Uso:
 *   .imggen <descrição>
 *
 * Exemplo:
 *   .imggen um gato astronauta a flutuar no espaço, estilo pixar
 */
const API_BASE = "https://image.pollinations.ai/prompt";

/** Constrói o URL do pedido. Função pura, testável isolada. */
export function buildImggenUrl(prompt, seed = Math.floor(Math.random() * 1_000_000)) {
  const encoded = encodeURIComponent(prompt.trim());
  return `${API_BASE}/${encoded}?width=1024&height=1024&nologo=true&seed=${seed}`;
}

export default {
  name: "imggen",
  aliases: ["gerarimagem", "aiimg"],
  description: "Gera uma imagem por IA a partir de um texto (.imggen <descrição>)",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Uso: .imggen <descrição>\n\nExemplo:\n• .imggen um gato astronauta no espaço, estilo pixar",
      }, { quoted: msg });
    }

    const prompt = args.join(" ").trim();
    const url = buildImggenUrl(prompt);

    let statusMsg;
    try {
      statusMsg = await sock.sendMessage(jid, { text: "🎨 *A gerar imagem...* (pode demorar até 30s)" }, { quoted: msg });
    } catch {}

    try {
      console.log(`[imggen] prompt: "${prompt}"`);
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });

      if (!res.ok) {
        throw new Error(`API devolveu HTTP ${res.status}`);
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length < 500) {
        throw new Error("Resposta vazia ou inválida da API");
      }

      console.log(`[imggen] ✅ ${(buffer.length / 1024).toFixed(0)}KB`);

      await sock.sendMessage(jid, {
        image: buffer,
        caption: `🎨 *${prompt}*`,
      }, { quoted: msg });

      if (statusMsg) try { await sock.sendMessage(jid, { delete: statusMsg.key }); } catch {}
    } catch (err) {
      console.error(`[imggen] ❌ erro: ${err.message}`);
      const text = `❌ Não consegui gerar a imagem.\n\n${err.message}`;
      if (statusMsg) {
        try { return await sock.sendMessage(jid, { text, edit: statusMsg.key }); } catch {}
      }
      await sock.sendMessage(jid, { text }, { quoted: msg });
    }
  },
};
