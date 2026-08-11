/**
 * Comando: .moeda
 * Conversão de moedas em tempo real via exchangerate-api (gratuita, sem key).
 * Especialmente útil para Angola (AOA, USD, EUR, ZAR, BRL, CNY).
 */
export default {
  name: "moeda",
  aliases: ["cambio", "kz"],
  description: "Conversão de moedas (.moeda 100 USD AOA)",

  async execute({ sock, jid, msg, args }) {
    if (args.length < 3) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .moeda <valor> <moeda origem> <moeda destino>\n\nExemplos:\n• .moeda 100 USD AOA\n• .moeda 50000 AOA EUR\n• .moeda 1 EUR USD\n\n💡 Moedas comuns: AOA, USD, EUR, BRL, GBP, ZAR, CNY"
      }, { quoted: msg });
    }

    const valor  = parseFloat(args[0].replace(",", "."));
    const origem = args[1].toUpperCase();
    const dest   = args[2].toUpperCase();

    if (isNaN(valor) || valor <= 0) {
      return sock.sendMessage(jid, { text: "❌ Valor inválido." }, { quoted: msg });
    }

    await sock.sendMessage(jid, {
      text: `💱 A verificar câmbio ${origem} → ${dest}...`
    }, { quoted: msg });

    try {
      const res = await fetch(
        `https://open.er-api.com/v6/latest/${origem}`,
        { signal: AbortSignal.timeout(10_000) }
      );

      if (!res.ok) throw new Error(`API retornou ${res.status}`);
      const data = await res.json();

      if (data.result !== "success") throw new Error("API sem sucesso");

      const rate = data.rates?.[dest];
      if (!rate) {
        return sock.sendMessage(jid, {
          text: `❌ Moeda *${dest}* não encontrada.\nVerifica o código (ex: USD, EUR, AOA, BRL).`
        }, { quoted: msg });
      }

      const resultado = valor * rate;

      // Formatação MANUAL — não usar toLocaleString("pt-PT"): essa locale
      // usa espaço não-separável para milhares (invisível/estranho em
      // muitos clientes WhatsApp) e depende dos dados de idioma instalados
      // no Node do servidor, que variam consoante o ambiente. Formato fixo
      // ponto=milhares / vírgula=decimais (convenção usada em Angola).
      const fmtNum = (n, maxDecimals = 2) => {
        const rounded = Math.round(n * 10 ** maxDecimals) / 10 ** maxDecimals;
        const [intPart, decPart = ""] = rounded.toFixed(maxDecimals).split(".");
        const intGrouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        const trimmedDec = decPart.replace(/0+$/, "");
        return trimmedDec ? `${intGrouped},${trimmedDec}` : intGrouped;
      };

      // A taxa pode ser um número muito pequeno (ex: AOA → USD) — 2 casas
      // decimais arredondaria para "0,00" e pareceria quebrado. Usa mais
      // casas decimais quando a taxa for menor que 1.
      const rateDecimals = Math.abs(rate) < 1 ? 6 : 2;

      await sock.sendMessage(jid, {
        text: `💱 *CONVERSÃO DE MOEDA*\n\n💵 Valor enviado: ${fmtNum(valor)} ${origem}\n🔄 Valor convertido: *${fmtNum(resultado)} ${dest}*\n\n📊 Taxa utilizada: 1 ${origem} = ${fmtNum(rate, rateDecimals)} ${dest}\n🕐 Dados: ${new Date(data.time_last_update_utc).toLocaleDateString("pt-PT")}`
      }, { quoted: msg });

    } catch (err) {
      console.error("[moeda] erro:", err.message);
      await sock.sendMessage(jid, {
        text: "⚠️ Não consegui obter as taxas de câmbio. Tenta novamente."
      }, { quoted: msg });
    }
  }
};
