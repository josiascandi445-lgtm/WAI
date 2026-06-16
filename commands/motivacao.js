/**
 * Comando: .motivacao
 * Envia uma frase motivacional original em português.
 */
const FRASES = [
  "O sucesso é a soma de pequenos esforços repetidos todos os dias.",
  "Não esperes pelo momento certo — cria-o tu mesmo.",
  "Cada erro é uma lição disfarçada de fracasso.",
  "A disciplina vence o talento quando o talento não trabalha.",
  "Quem desiste no início nunca descobre como a história termina.",
  "O teu único limite és tu mesmo.",
  "Grandes resultados exigem grandes ambições.",
  "Persistência transforma o impossível em inevitável.",
  "Não contes os dias, faz com que os dias contem.",
  "A jornada de mil quilómetros começa com um único passo.",
  "Acredita no processo, mesmo quando não vês resultados imediatos.",
  "O medo é apenas a falta de confiança nas tuas próprias capacidades.",
  "Cada amanhecer é uma nova oportunidade de recomeçar.",
  "A vitória pertence a quem mais persiste, não a quem mais talento tem.",
  "Sonha grande, trabalha mais, fala menos.",
];

export default {
  name: "motivacao",
  aliases: ["frase", "inspiracao"],
  description: "Envia uma frase motivacional",

  async execute({ sock, jid, msg }) {
    const frase = FRASES[Math.floor(Math.random() * FRASES.length)];
    await sock.sendMessage(jid, {
      text: `💪 *Motivação do momento*\n\n_"${frase}"_`
    }, { quoted: msg });
  }
};
