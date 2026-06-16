/**
 * Comando: .senha
 * Gera uma senha segura e aleatória.
 * Uso: .senha       → 16 caracteres (padrão)
 *      .senha 24    → 24 caracteres
 */
export default {
  name: "senha",
  aliases: ["password", "gerarsenha"],
  description: "Gera uma senha segura e aleatória (.senha [tamanho])",

  async execute({ sock, jid, msg, args }) {
    let tamanho = Number(args[0]) || 16;
    tamanho = Math.min(Math.max(tamanho, 8), 64);

    const minusculas = "abcdefghijklmnopqrstuvwxyz";
    const maiusculas = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numeros    = "0123456789";
    const simbolos    = "!@#$%^&*()_-+=";
    const todos = minusculas + maiusculas + numeros + simbolos;

    // Garante pelo menos um de cada tipo
    let senha = [
      minusculas[Math.floor(Math.random() * minusculas.length)],
      maiusculas[Math.floor(Math.random() * maiusculas.length)],
      numeros[Math.floor(Math.random() * numeros.length)],
      simbolos[Math.floor(Math.random() * simbolos.length)],
    ];

    for (let i = senha.length; i < tamanho; i++) {
      senha.push(todos[Math.floor(Math.random() * todos.length)]);
    }

    // Embaralha
    senha = senha.sort(() => Math.random() - 0.5).join("");

    await sock.sendMessage(jid, {
      text: `🔐 *Senha gerada (${tamanho} caracteres)*\n\n\`${senha}\`\n\n⚠️ Não partilhes esta senha com ninguém.`
    }, { quoted: msg });
  }
};
