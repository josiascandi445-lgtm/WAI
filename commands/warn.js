/**
 * Comando: .warn @user
 * FIX P3: warns persistidos em ficheiro JSON (sobrevivem a restarts).
 * FIX P4: verifica se o bot é admin antes de remover.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WARNS_FILE = path.join(__dirname, "../data/warns.json");

// Garante pasta data
const dataDir = path.join(__dirname, "../data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function loadWarns() {
  try {
    if (!fs.existsSync(WARNS_FILE)) return {};
    return JSON.parse(fs.readFileSync(WARNS_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveWarns(data) {
  try {
    fs.writeFileSync(WARNS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("[warn] Erro ao salvar warns:", err.message);
  }
}

export default {
  name: "warn",
  description: "Avisa um membro do grupo (3 avisos = ban)",

  async execute({ sock, jid, msg, args, isGroup }) {
    if (!isGroup) {
      return sock.sendMessage(jid, {
        text: "❌ Este comando só funciona em grupos."
      }, { quoted: msg });
    }

    // Aceita menção ou número
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
    let targetJid = mentioned[0] ?? null;

    if (!targetJid && args.length) {
      const number = args[0].replace(/[^0-9]/g, "");
      if (number) targetJid = `${number}@s.whatsapp.net`;
    }

    if (!targetJid) {
      return sock.sendMessage(jid, {
        text: "❌ Usa: .warn @utilizador  ou  .warn 244912345678"
      }, { quoted: msg });
    }

    // FIX P4: verifica se o bot é admin
    let isAdmin = false;
    try {
      const metadata = await sock.groupMetadata(jid);
      const botJid = sock.user.id.split(":")[0] + "@s.whatsapp.net";
      isAdmin = metadata.participants.some(
        p => p.id === botJid && (p.admin === "admin" || p.admin === "superadmin")
      );
    } catch (err) {
      console.error("[warn] Erro ao verificar admin:", err.message);
    }

    // FIX P3: persistência em ficheiro
    const warns = loadWarns();
    const key = `${jid}:${targetJid}`;
    const current = warns[key] || 0;
    const newCount = current + 1;
    warns[key] = newCount;
    saveWarns(warns);

    const number = targetJid.split("@")[0];

    await sock.sendMessage(jid, {
      text: `⚠️ Aviso para *${number}*\nTotal de avisos: *${newCount}/3*`
    }, { quoted: msg });

    if (newCount >= 3) {
      warns[key] = 0; // Reset após ban
      saveWarns(warns);

      if (!isAdmin) {
        return sock.sendMessage(jid, {
          text: `⚠️ *${number}* atingiu 3 avisos mas não consigo banir — preciso de ser admin.`
        }, { quoted: msg });
      }

      try {
        await sock.groupParticipantsUpdate(jid, [targetJid], "remove");
        await sock.sendMessage(jid, {
          text: `🚫 *${number}* foi expulso após 3 avisos.`
        }, { quoted: msg });
      } catch (err) {
        await sock.sendMessage(jid, {
          text: `⚠️ Não consegui expulsar *${number}*: ${err.message}`
        }, { quoted: msg });
      }
    }
  }
};
