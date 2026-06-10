// lib/antilink.js

// Guarda o estado de cada grupo
// true = ativo | false = desativo
export const antiLinkGroups = new Map();

/**
 * Ativa anti-link num grupo
 */
export function enableAntiLink(jid) {
  antiLinkGroups.set(jid, true);
}

/**
 * Desativa anti-link num grupo
 */
export function disableAntiLink(jid) {
  antiLinkGroups.set(jid, false);
}

/**
 * Verifica se está ativo
 */
export function isAntiLinkEnabled(jid) {
  return antiLinkGroups.get(jid) === true;
}

/**
 * Detecta links numa mensagem
 */
export function containsLink(text = "") {
  return /(https?:\/\/|www\.|wa\.me|chat\.whatsapp\.com)/i.test(text);
}

/**
 * Processa automaticamente anti-link
 * (usar dentro do handleMessage)
 */
export async function handleAntiLink({ sock, msg, jid, sender, text, isGroup }) {
  if (!isGroup) return false;
  if (!isAntiLinkEnabled(jid)) return false;

  if (!containsLink(text)) return false;

  try {
    // tenta apagar mensagem (só funciona se o bot for admin)
    await sock.sendMessage(jid, {
      delete: msg.key,
    });

    // aviso no grupo
    await sock.sendMessage(jid, {
      text: `🚫 Link removido automaticamente\n👤 ${sender}`,
    });

    console.log("[anti-link] mensagem removida de:", sender);

    return true; // bloqueia processamento normal
  } catch (err) {
    console.log("[anti-link] erro ao apagar mensagem:", err.message);
    return false;
  }
}
