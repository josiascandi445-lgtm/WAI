import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { isAdmin, isBotAdmin, findParticipantJid } from "../lib/groupUtils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WARNS_FILE = path.join(__dirname, "../data/warns.json");
const dataDir = path.join(__dirname, "../data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function loadWarns() {
  try {
    if (!fs.existsSync(WARNS_FILE)) return {};
    return JSON.parse(fs.readFileSync(WARNS_FILE, "utf8"));
  } catch { return {}; }
}

function saveWarns(data) {
  try { fs.writeFileSync(WARNS_FILE, JSON.stringify(data, null, 2)); } catch {}
}

export default {
  name: "warn",
  description: "Avisa membro do grupo (3 avisos = remoção)",

  async execute({ sock, jid, msg, sender, rawSender, args, isGroup }) {
    if (!isGroup) {
      return sock.sendMessage(jid, { text: "❌ Este comando só funciona em grupos." }, { quoted: msg });
    }

    const senderIsAdmin = await isAdmin(sock, jid, rawSender ?? sender);
    if (!senderIsAdmin) {
      return sock.sendMessage(jid, { text: "❌ Só os administradores podem usar este comando." }, { quoted: msg });
    }

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
    let targetJid = mentioned[0] ?? null;

    if (!targetJid && args.length) {
      const num = args[0].replace(/[^0-9]/g, "");
      if (num) targetJid = await findParticipantJid(sock, jid, num) ?? `${num}@s.whatsapp.net`;
    }

    if (!targetJid) {
      return sock.sendMessage(jid, { text: "❌ Usa: .warn @utilizador" }, { quoted: msg });
    }

    const warns = loadWarns();
    const key = `${jid}:${targetJid}`;
    const count = (warns[key] || 0) + 1;
    warns[key] = count;
    saveWarns(warns);

    const num = targetJid.split("@")[0];
    await sock.sendMessage(jid, {
      text: `⚠️ Aviso para *${num}*\nTotal: *${count}/3*`
    }, { quoted: msg });

    if (count >= 3) {
      warns[key] = 0;
      saveWarns(warns);

      const botIsAdmin = await isBotAdmin(sock, jid);
      if (!botIsAdmin) {
        return sock.sendMessage(jid, {
          text: `⚠️ *${num}* atingiu 3 avisos mas não consigo remover — preciso de ser admin.`
        }, { quoted: msg });
      }

      try {
        await sock.groupParticipantsUpdate(jid, [targetJid], "remove");
        await sock.sendMessage(jid, { text: `🚫 *${num}* removido após 3 avisos.` }, { quoted: msg });
      } catch (err) {
        await sock.sendMessage(jid, { text: `⚠️ Não consegui remover *${num}*: ${err.message}` }, { quoted: msg });
      }
    }
  }
};
