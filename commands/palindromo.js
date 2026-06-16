/**
 * Comando: .palindromo
 * Verifica se uma palavra ou frase é um palíndromo.
 * Uso: .palindromo arara
 */
export default {
  name: "palindromo",
  aliases: ["pal"],
  description: "Verifica se uma palavra/frase é um palíndromo",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .palindromo <palavra ou frase>\nEx: .palindromo arara"
      }, { quoted: msg });
    }

    const original = args.join(" ");
    const limpo = original.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    const invertido = limpo.split("").reverse().join("");
    const ehPalindromo = limpo === invertido && limpo.length > 0;

    await sock.sendMessage(jid, {
      text: ehPalindromo
        ? `✅ *"${original}"* é um palíndromo! 🎉\n\nLê-se igual ao contrário.`
        : `❌ *"${original}"* não é um palíndromo.`
    }, { quoted: msg });
  }
};
