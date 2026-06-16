/**
 * Comando: .numero
 * Identifica o país e operadora aproximada de um número de telefone
 * a partir do código internacional.
 * Uso: .numero 244923456789
 */
const PAISES = {
  "244": { nome: "Angola", emoji: "🇦🇴" },
  "351": { nome: "Portugal", emoji: "🇵🇹" },
  "55":  { nome: "Brasil", emoji: "🇧🇷" },
  "258": { nome: "Moçambique", emoji: "🇲🇿" },
  "238": { nome: "Cabo Verde", emoji: "🇨🇻" },
  "245": { nome: "Guiné-Bissau", emoji: "🇬🇼" },
  "239": { nome: "São Tomé e Príncipe", emoji: "🇸🇹" },
  "1":   { nome: "EUA/Canadá", emoji: "🇺🇸" },
  "44":  { nome: "Reino Unido", emoji: "🇬🇧" },
  "34":  { nome: "Espanha", emoji: "🇪🇸" },
  "33":  { nome: "França", emoji: "🇫🇷" },
  "49":  { nome: "Alemanha", emoji: "🇩🇪" },
  "27":  { nome: "África do Sul", emoji: "🇿🇦" },
  "86":  { nome: "China", emoji: "🇨🇳" },
  "91":  { nome: "Índia", emoji: "🇮🇳" },
};

export default {
  name: "numero",
  aliases: ["ddd", "pais"],
  description: "Identifica o país de um número de telefone",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .numero <número com código do país>\nEx: .numero 244923456789"
      }, { quoted: msg });
    }

    const num = args[0].replace(/[^0-9]/g, "");

    if (num.length < 8) {
      return sock.sendMessage(jid, { text: "❌ Número demasiado curto." }, { quoted: msg });
    }

    // Tenta encontrar o código de país (1 a 3 dígitos)
    let pais = null;
    for (let len = 3; len >= 1; len--) {
      const prefixo = num.slice(0, len);
      if (PAISES[prefixo]) { pais = PAISES[prefixo]; break; }
    }

    if (!pais) {
      return sock.sendMessage(jid, {
        text: `📱 *${num}*\n\n❓ País não identificado na minha lista local.`
      }, { quoted: msg });
    }

    await sock.sendMessage(jid, {
      text: `📱 *Análise de Número*\n\n${pais.emoji} País: *${pais.nome}*\n🔢 Número: ${num}`
    }, { quoted: msg });
  }
};
