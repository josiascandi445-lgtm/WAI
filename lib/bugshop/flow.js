/**
 * lib/bugshop/flow.js
 *
 * A máquina de passos do menu da Bug Shop. Recebe a sessão actual do
 * utilizador + o que ele respondeu, e devolve o próximo ecrã (texto) +
 * a sessão actualizada (ou null se o fluxo terminou/foi cancelado).
 *
 * Nunca confia no preço vindo do utilizador — todos os preços vêm
 * sempre de lib/bugshop/catalog.js, nunca de texto recebido.
 */
import { CATEGORIES, getCategory, getProduct, formatKz } from "./catalog.js";
import * as store from "./store.js";
import * as screens from "./screens.js";

const DEDUPE_WINDOW_MS = 10_000;
const recentMessageIds = new Map(); // messageId -> timestamp (evita processar o mesmo evento 2x)

function isDuplicateMessage(messageId) {
  if (!messageId) return false;
  const now = Date.now();
  for (const [id, ts] of recentMessageIds) {
    if (now - ts > DEDUPE_WINDOW_MS) recentMessageIds.delete(id);
  }
  if (recentMessageIds.has(messageId)) return true;
  recentMessageIds.set(messageId, now);
  return false;
}

function extractCustomerNumber(jid) {
  return jid.replace(/@.*$/, "").replace(/[^0-9]/g, "");
}

/** Inicia (ou reinicia) o fluxo — chamado por commands/produtos.js */
export function startBugshop(userJid) {
  const session = { step: "main" };
  store.setSession(userJid, session);
  return screens.mainMenuScreen();
}

/**
 * Processa uma resposta do utilizador dentro de uma sessão activa.
 * @returns {string} texto a enviar (a sessão já fica persistida internamente)
 */
export function handleBugshopInput({ userJid, customerName, messageId }, input) {
  if (isDuplicateMessage(messageId)) {
    console.log(`[bugshop] mensagem duplicada ignorada: ${messageId}`);
    return null; // não responde 2x ao mesmo evento
  }

  const session = store.getSession(userJid);
  if (!session) return null; // sem sessão activa — não é connosco (ver onMessage.js)

  const text = String(input || "").trim();
  const choice = text; // alias — mais legível abaixo

  switch (session.step) {
    // ── Menu principal → escolher categoria ────────────────────────
    case "main": {
      if (choice === "0") { store.clearSession(userJid); return screens.cancelledScreen(); }
      const idx = parseInt(choice, 10) - 1;
      const category = CATEGORIES[idx];
      if (!category || String(idx + 1) !== choice) return screens.invalidOptionScreen();

      store.setSession(userJid, { step: "category", categoryCode: category.code });
      return screens.categoryScreen(category);
    }

    // ── Categoria → escolher produto ───────────────────────────────
    case "category": {
      const category = getCategory(session.categoryCode);
      if (!category) { store.clearSession(userJid); return screens.noActiveSessionScreen(process.env.PREFIX ?? "."); }

      if (choice === "0") {
        store.setSession(userJid, { step: "main" });
        return screens.mainMenuScreen();
      }
      const idx = parseInt(choice, 10) - 1;
      const product = category.products[idx];
      if (!product || String(idx + 1) !== choice) return screens.invalidOptionScreen();

      store.setSession(userJid, { step: "product", categoryCode: category.code, productCode: product.code });
      return screens.productScreen(product);
    }

    // ── Ecrã do produto → comprar / informações / voltar ───────────
    case "product": {
      const product = getProduct(session.productCode);
      const category = getCategory(session.categoryCode);
      if (!product || !category) { store.clearSession(userJid); return screens.noActiveSessionScreen(process.env.PREFIX ?? "."); }

      if (choice === "0") {
        store.setSession(userJid, { step: "category", categoryCode: category.code });
        return screens.categoryScreen(category);
      }
      if (choice === "2") {
        store.setSession(userJid, { ...session, step: "info" });
        return screens.infoScreen(product, category);
      }
      if (choice === "1") {
        store.setSession(userJid, { ...session, step: "awaiting_ffid" });
        return screens.askFFIdScreen();
      }
      return screens.invalidOptionScreen();
    }

    // ── Ecrã de informações → só permite voltar ────────────────────
    case "info": {
      const product = getProduct(session.productCode);
      if (choice === "0" && product) {
        store.setSession(userJid, { ...session, step: "product" });
        return screens.productScreen(product);
      }
      return screens.invalidOptionScreen();
    }

    // ── A aguardar o ID do Free Fire (texto livre, não numérico-menu) ──
    case "awaiting_ffid": {
      if (!/^\d+$/.test(choice)) return screens.invalidFFIdScreen();

      const product = getProduct(session.productCode);
      if (!product) { store.clearSession(userJid); return screens.noActiveSessionScreen(process.env.PREFIX ?? "."); }

      store.setSession(userJid, { ...session, step: "confirm_order", ffId: choice });
      return screens.orderPreviewScreen(product, choice);
    }

    // ── Pré-visualização do pedido → confirmar / cancelar ──────────
    case "confirm_order": {
      if (choice === "0") { store.clearSession(userJid); return screens.cancelledScreen(); }
      if (choice !== "1") return screens.invalidOptionScreen();

      const product = getProduct(session.productCode);
      if (!product) { store.clearSession(userJid); return screens.noActiveSessionScreen(process.env.PREFIX ?? "."); }

      // Preço vem SEMPRE do catálogo — nunca de nada que o utilizador enviou.
      const order = store.createOrder({
        userJid,
        customerName,
        customerNumber: extractCustomerNumber(userJid),
        productCode: product.code,
        categoryCode: product.categoryCode,
        productLabel: product.label,
        price: product.price,
        ffId: session.ffId,
      });

      store.setSession(userJid, { step: "payment_method", orderId: order.orderId });
      return screens.paymentMethodScreen(order);
    }

    // ── Escolher método de pagamento ────────────────────────────────
    case "payment_method": {
      const order = store.getOrder(session.orderId);
      if (!order) { store.clearSession(userJid); return screens.noActiveSessionScreen(process.env.PREFIX ?? "."); }

      let methodKey, methodLabel;
      if (choice === "1") { methodKey = "multicaixa"; methodLabel = "💙 *MULTICAIXA EXPRESS*"; }
      else if (choice === "2") { methodKey = "paypay"; methodLabel = "💚 *PAYPAY*"; }
      else return screens.invalidOptionScreen();

      store.updateOrder(order.orderId, { paymentMethod: methodKey });
      store.setSession(userJid, { step: "payment_instructions", orderId: order.orderId });
      return screens.paymentInstructionsScreen(order, methodLabel);
    }

    // ── Ecrã de instruções → "já paguei" ────────────────────────────
    case "payment_instructions": {
      const order = store.getOrder(session.orderId);
      if (!order) { store.clearSession(userJid); return screens.noActiveSessionScreen(process.env.PREFIX ?? "."); }

      if (choice !== "1") return screens.invalidOptionScreen();

      // "Já paguei" NUNCA marca como pago automaticamente — só regista
      // que o comprovativo é esperado. Confirmação é sempre manual.
      const updated = store.updateOrder(order.orderId, { status: store.STATUS.PAGAMENTO_ENVIADO });
      store.clearSession(userJid); // fluxo terminado — o resto é atendimento manual
      return screens.alreadyPaidScreen(updated);
    }

    default: {
      store.clearSession(userJid);
      return screens.noActiveSessionScreen(process.env.PREFIX ?? ".");
    }
  }
}
