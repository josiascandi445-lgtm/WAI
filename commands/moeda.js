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
      const fmtNum = (n) => n.toLocaleString("pt-PT", { maximumFractionDigits: 2 });

      await sock.sendMessage(jid, {
        text: `💱 *Conversão de Moedas*\n\n💰 ${fmtNum(valor)} ${origem}\n\n🔄 = *${fmtNum(resultado)} ${dest}*\n\n📊 Taxa: 1 ${origem} = ${fmtNum(rate)} ${dest}\n🕐 Dados: ${new Date(data.time_last_update_utc).toLocaleDateString("pt-PT")}`
      }, { quoted: msg });

    } catch (err) {
      console.error("[moeda] erro:", err.message);
      await sock.sendMessage(jid, {
        text: "⚠️ Não consegui obter as taxas de câmbio. Tenta novamente."
      }, { quoted: msg });
    }
  }
};
