/**
 * Comando: .calc
 * Calculadora simples e segura (sem eval).
 * Suporta: + - * / % ^ raiz() arred()
 */
function calcSeguro(expr) {
  // Normaliza
  expr = expr
    .replace(/\s+/g, "")
    .replace(/,/g, ".")
    .replace(/x/gi, "*")
    .replace(/÷/g, "/")
    .replace(/raiz\(([^)]+)\)/g, (_, n) => String(Math.sqrt(parseFloat(n))))
    .replace(/arred\(([^)]+)\)/g, (_, n) => String(Math.round(parseFloat(n))))
    .replace(/abs\(([^)]+)\)/g, (_, n) => String(Math.abs(parseFloat(n))));

  // Só permite números e operadores seguros
  if (!/^[\d+\-*/%.^()\s]+$/.test(expr)) throw new Error("Expressão inválida");

  // Avalia com Function (mais seguro que eval — sem acesso a variáveis)
  // eslint-disable-next-line no-new-func
  const result = Function(`"use strict"; return (${expr.replace(/\^/g, "**")})`)();
  if (!isFinite(result)) throw new Error("Resultado inválido (divisão por zero?)");
  return result;
}

export default {
  name: "calc",
  aliases: ["calcular", "matematica"],
  description: "Calculadora (.calc 25 * 4 + 10)",

  async execute({ sock, jid, msg, args }) {
    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .calc <expressão>\n\nExemplos:\n• .calc 25 * 4\n• .calc 100 / 3\n• .calc 2 ^ 10\n• .calc raiz(144)\n• .calc (50 + 30) * 2"
      }, { quoted: msg });
    }

    const expr = args.join(" ");

    try {
      const resultado = calcSeguro(expr);
      const formatado = Number.isInteger(resultado)
        ? resultado.toLocaleString("pt-PT")
        : resultado.toLocaleString("pt-PT", { maximumFractionDigits: 6 });

      await sock.sendMessage(jid, {
        text: `🧮 *Calculadora*\n\n📝 ${expr}\n\n✅ Resultado: *${formatado}*`
      }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(jid, {
        text: `❌ Expressão inválida: _${expr}_\n\nVerifica a sintaxe e tenta novamente.`
      }, { quoted: msg });
    }
  }
};
