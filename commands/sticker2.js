/**
 * Comando: .sticker2 / .s2
 * Cria um sticker com texto sobre fundo branco.
 * Uso: .sticker2 manga
 */
import sharp from "sharp";

export default {
  name: "sticker2",
  aliases: ["s2"],
  description: "Cria sticker com texto em fundo branco (.sticker2 texto)",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .sticker2 texto\nEx: .sticker2 manga"
      }, { quoted: msg });
    }

    const texto = args.join(" ");

    // Quebra o texto em linhas para caber no sticker (máx ~14 caracteres por linha)
    const palavras = texto.split(" ");
    const linhas = [];
    let linhaActual = "";

    for (const p of palavras) {
      if ((linhaActual + " " + p).trim().length > 14) {
        if (linhaActual) linhas.push(linhaActual.trim());
        linhaActual = p;
      } else {
        linhaActual = (linhaActual + " " + p).trim();
      }
    }
    if (linhaActual) linhas.push(linhaActual.trim());

    // Limita a 6 linhas
    const linhasFinais = linhas.slice(0, 6);

    // Tamanho da fonte ajusta-se ao número de linhas
    const fontSize = linhasFinais.length <= 2 ? 64 : linhasFinais.length <= 4 ? 48 : 36;
    const lineHeight = fontSize * 1.3;
    const startY = 256 - (linhasFinais.length * lineHeight) / 2 + lineHeight / 2;

    const linhasSvg = linhasFinais.map((linha, i) =>
      `<text x="256" y="${startY + i * lineHeight}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#000000" text-anchor="middle">${escapeXml(linha)}</text>`
    ).join("\n");

    function escapeXml(str) {
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    const svg = `
      <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
        <rect width="512" height="512" fill="#ffffff"/>
        ${linhasSvg}
      </svg>
    `;

    try {
      const buffer = await sharp(Buffer.from(svg))
        .webp({ quality: 90 })
        .toBuffer();

      await sock.sendMessage(jid, { sticker: buffer }, { quoted: msg });
    } catch (err) {
      console.error("[sticker2] erro:", err.message);
      await sock.sendMessage(jid, {
        text: "⚠️ Erro ao criar o sticker. Tenta um texto mais curto."
      }, { quoted: msg });
    }
  }
};
