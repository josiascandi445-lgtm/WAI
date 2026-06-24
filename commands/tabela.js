/**
 * Comando: .tabela / .tab
 * Tabela de produtos e preços, persistida em disco por grupo.
 *
 * .tab              — mostra a tabela do grupo
 * .tab add nome | preço — adiciona produto
 * .tab r 2          — remove produto pelo número
 * .tab r nome       — remove produto pelo nome
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR   = path.join(__dirname, "../data");
const TABELA_FILE = path.join(DATA_DIR, "tabelas.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function load() {
  try {
    if (!fs.existsSync(TABELA_FILE)) return {};
    return JSON.parse(fs.readFileSync(TABELA_FILE, "utf8"));
  } catch { return {}; }
}

function save(data) {
  try { fs.writeFileSync(TABELA_FILE, JSON.stringify(data, null, 2)); } catch {}
}

function getTabela(jid) {
  const all = load();
  if (!all[jid]) all[jid] = [];
  return { all, items: all[jid] };
}

export default {
  name: "tabela",
  aliases: ["tab"],
  description: "Tabela de produtos do grupo (.tab add nome|preço / .tab r 2)",

  async execute({ sock, jid, msg, sender, args, isGroup }) {
    if (!isGroup) {
      return sock.sendMessage(jid, { text: "❌ Este comando só funciona em grupos." }, { quoted: msg });
    }

    const sub = args[0]?.toLowerCase();

    // ── ADICIONAR: .tab add nome do produto | preço ────────────────
    if (sub === "add") {
      const resto = args.slice(1).join(" ");
      const partes = resto.split("|").map(p => p.trim());

      if (partes.length < 2 || !partes[0] || !partes[1]) {
        return sock.sendMessage(jid, {
          text: "❌ Usa: .tab add Nome do produto | preço\nEx: .tab add Conta FF | 2.000kz"
        }, { quoted: msg });
      }

      const { all, items } = getTabela(jid);
      if (items.length >= 30) {
        return sock.sendMessage(jid, { text: "⚠️ Máximo de 30 produtos por grupo." }, { quoted: msg });
      }

      items.push({ nome: partes[0], preco: partes[1] });
      all[jid] = items;
      save(all);

      return sock.sendMessage(jid, {
        text: `✅ *${partes[0]}* adicionado à tabela com o preço *${partes[1]}*.`
      }, { quoted: msg });
    }

    // ── REMOVER: .tab r 2  ou  .tab r nome do produto ─────────────
    if (sub === "r" || sub === "rm" || sub === "remove") {
      const { all, items } = getTabela(jid);

      if (!items.length) {
        return sock.sendMessage(jid, { text: "⚠️ A tabela está vazia." }, { quoted: msg });
      }

      const alvo = args.slice(1).join(" ").trim();
      if (!alvo) {
        return sock.sendMessage(jid, {
          text: "❌ Indica o número ou nome do produto.\nEx: .tab r 2  ou  .tab r Conta FF"
        }, { quoted: msg });
      }

      const idx = parseInt(alvo);
      let removido;

      if (!isNaN(idx) && idx >= 1 && idx <= items.length) {
        removido = items.splice(idx - 1, 1)[0];
      } else {
        const i = items.findIndex(p => p.nome.toLowerCase() === alvo.toLowerCase());
        if (i === -1) {
          return sock.sendMessage(jid, {
            text: `❌ Produto "*${alvo}*" não encontrado.`
          }, { quoted: msg });
        }
        removido = items.splice(i, 1)[0];
      }

      all[jid] = items;
      save(all);

      return sock.sendMessage(jid, {
        text: `🗑️ *${removido.nome}* removido da tabela.`
      }, { quoted: msg });
    }

    // ── MOSTRAR TABELA ─────────────────────────────────────────────
    const { items } = getTabela(jid);

    let groupName = jid.split("@")[0];
    try {
      const meta = await sock.groupMetadata(jid);
      groupName  = meta.subject || groupName;
      const totalMembros = meta.participants.length;
      const totalAdmins  = meta.participants.filter(p => p.admin).length;

      if (!items.length) {
        return sock.sendMessage(jid, {
          text: `⚠️ A tabela de *${groupName}* está vazia.\nAdiciona com: .tab add Nome | Preço`
        }, { quoted: msg });
      }

      const linhas = items.map((p, i) =>
        `┃┃ ${i + 1}- ${p.nome}\n┃┃ preço: ${p.preco}\n┃┃━━━━━━━━━━━━━━━━━━━━━`
      ).join("\n");

      const texto =
`╭━◌━━🟢${groupName}🟢━━◌━╮
┃┃━━━━━━━━━━━━━━━━━━━━━
┃┃🧾 Tabela de produtos
┃┃━━━━━━━━━━━━━━━━━━━━━
${linhas}
┃┃📌 Informações do grupo
┃┃🔥 Produtos › ${items.length}
┃┃👤 membros › ${totalMembros}
┃┃👑 adms › ${totalAdmins}
╰━◌━━『 ${groupName} 』━━◌━╯`;

      await sock.sendMessage(jid, { text: texto }, { quoted: msg });

    } catch (err) {
      console.error(`[tabela] erro ao obter metadata: ${err.message}`);
      await sock.sendMessage(jid, {
        text: "⚠️ Não consegui carregar a tabela. Tenta novamente."
      }, { quoted: msg });
    }
  }
};
