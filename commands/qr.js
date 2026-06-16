/**
 * Comando: .qr
 * Gera um código QR a partir de texto ou URL.
 * Uso: .qr https://exemplo.com
 */
export default {
  name: "qr",
  aliases: ["qrcode"],
  description: "Gera um código QR a partir de texto ou URL",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .qr <texto ou URL>\nEx: .qr https://wa.me/244912345678"
      }, { quoted: msg });
    }

    const texto = args.join(" ");

    try {
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(texto)}`;

      await sock.sendMessage(jid, {
        image: { url },
        caption: `📱 *Código QR gerado*\n\n📝 Conteúdo: ${texto.length > 50 ? texto.slice(0, 50) + "..." : texto}`
      }, { quoted: msg });

    } catch (err) {
      console.error("[qr] erro:", err.message);
      await sock.sendMessage(jid, { text: "⚠️ Erro ao gerar o código QR." }, { quoted: msg });
    }
  }
};
