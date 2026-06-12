/**
 * Comando: .clima / .tempo
 * Condições meteorológicas actuais via wttr.in (sem API key, em PT).
 */
export default {
  name: "clima",
  aliases: ["tempo", "weather2"],
  description: "Clima actual de qualquer cidade (.clima Luanda)",

  async execute({ sock, jid, msg, args }) {
    const cidade = args.length ? args.join(" ") : "Luanda";

    await sock.sendMessage(jid, {
      text: `🌤️ A verificar o clima em *${cidade}*...`
    }, { quoted: msg });

    try {
      const url = `https://wttr.in/${encodeURIComponent(cidade)}?format=j1&lang=pt`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`wttr.in retornou ${res.status}`);

      const data = await res.json();
      const cur  = data.current_condition?.[0];
      if (!cur) throw new Error("Sem dados");

      const desc  = cur.lang_pt?.[0]?.value || cur.weatherDesc?.[0]?.value || "N/A";
      const temp  = cur.temp_C;
      const feels = cur.FeelsLikeC;
      const humid = cur.humidity;
      const wind  = cur.windspeedKmph;
      const vis   = cur.visibility;

      // Emoji de condição
      const emojiMap = [
        ["sol", "☀️"], ["limpo", "☀️"], ["clear", "☀️"],
        ["nublado", "☁️"], ["nuvem", "⛅"], ["cloud", "☁️"],
        ["chuva", "🌧️"], ["rain", "🌧️"], ["chuvisco", "🌦️"],
        ["trovoada", "⛈️"], ["thunder", "⛈️"],
        ["neve", "❄️"], ["snow", "❄️"],
        ["nevoeiro", "🌫️"], ["fog", "🌫️"],
      ];
      let emoji = "🌡️";
      const descLow = desc.toLowerCase();
      for (const [k, e] of emojiMap) {
        if (descLow.includes(k)) { emoji = e; break; }
      }

      const text =
`${emoji} *Clima em ${cidade.charAt(0).toUpperCase() + cidade.slice(1)}*

🌡️ Temperatura: *${temp}°C* (sensação ${feels}°C)
🌤️ Condição: *${desc}*
💧 Humidade: *${humid}%*
💨 Vento: *${wind} km/h*
👁️ Visibilidade: *${vis} km*`;

      await sock.sendMessage(jid, { text }, { quoted: msg });

    } catch (err) {
      console.error("[clima] erro:", err.message);
      await sock.sendMessage(jid, {
        text: `⚠️ Não encontrei dados para *${cidade}*.\nVerifica o nome da cidade e tenta novamente.`
      }, { quoted: msg });
    }
  }
};
