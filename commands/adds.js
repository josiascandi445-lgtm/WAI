/**
 * Comando: .adds
 * Adiciona vários membros ao grupo de uma vez.
 * Uso: .adds 244900000000, 244911111111, 244922222222
 */
import { isAdmin, isBotAdmin } from "../lib/groupUtils.js";

export default {
  name: "adds",
  aliases: ["addmany"],
  description: "Adiciona vários membros ao grupo (separados por vírgula)",

  async execute({ sock, jid, msg, sender, rawSender, args, isGroup }) {
    if (!isGroup) {
      return sock.sendMessage(jid, { text: "❌ Este comando só funciona em grupos." }, { quoted: msg });
    }

    const senderIsAdmin = await isAdmin(sock, jid, rawSender ?? sender);
    if (!senderIsAdmin) {
      return sock.sendMessage(jid, { text: "❌ Só os administradores podem usar este comando." }, { quoted: msg });
    }

    const botIsAdmin = await isBotAdmin(sock, jid);
    if (!botIsAdmin) {
      return sock.sendMessage(jid, { text: "⚠️ Preciso de ser admin para adicionar membros." }, { quoted: msg });
    }

    if (!args.length) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .adds 244900000000, 244911111111, 244922222222"
      }, { quoted: msg });
    }

    // Junta os args e separa por vírgula
    const numeros = args.join(" ").split(",")
      .map(n => n.replace(/[^0-9]/g, ""))
      .filter(n => n.length >= 9);

    if (!numeros.length) {
      return sock.sendMessage(jid, {
        text: "❌ Nenhum número válido encontrado. Separa os números por vírgula."
      }, { quoted: msg });
    }

    if (numeros.length > 15) {
      return sock.sendMessage(jid, {
        text: "⚠️ Máximo de 15 números por vez (limite do WhatsApp)."
      }, { quoted: msg });
    }

    await sock.sendMessage(jid, {
      text: `⏳ A adicionar ${numeros.length} membro(s)...`
    }, { quoted: msg });

    const jids = numeros.map(n => `${n}@s.whatsapp.net`);

    try {
      const resultado = await sock.groupParticipantsUpdate(jid, jids, "add");

      const sucesso = resultado.filter(r => r.status === "200").map(r => r.jid.split("@")[0]);
      const falhou  = resultado.filter(r => r.status !== "200").map(r => r.jid.split("@")[0]);

      let texto = "";
      if (sucesso.length) texto += `✅ *Adicionados (${sucesso.length}):*\n${sucesso.join(", ")}\n\n`;
      if (falhou.length)  texto += `❌ *Falharam (${falhou.length}):*\n${falhou.join(", ")}\n_(podem ter privacidade activada ou já estar no grupo)_`;

      await sock.sendMessage(jid, { text: texto || "⚠️ Não consegui adicionar nenhum membro." }, { quoted: msg });

    } catch (err) {
      console.error("[adds] erro:", err.message);
      await sock.sendMessage(jid, { text: `⚠️ Erro ao adicionar membros: ${err.message}` }, { quoted: msg });
    }
  }
};
