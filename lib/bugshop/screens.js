/**
 * lib/bugshop/screens.js
 *
 * Texto de cada ecrã do menu da Bug Shop. Funções puras — a lógica de
 * navegação (lib/bugshop/flow.js) nunca escreve texto directamente, só
 * chama estas funções. Assim dá para ajustar o visual sem mexer na
 * máquina de passos.
 *
 * IMPORTANTE (ver README/handlers/onMessage.js): a versão do Baileys
 * usada neste projecto deixou de suportar botões/listas nativos
 * clicáveis do WhatsApp. Por isso a navegação aqui é por NÚMERO — o
 * utilizador responde só com "1", "2"... "0" para voltar/cancelar.
 */
import { CATEGORIES, formatKz } from "./catalog.js";

export function mainMenuScreen() {
  const lines = CATEGORIES.map((c, i) => `┃ ${i + 1}️⃣ ${c.label}`).join("\n");
  return (
    `╭━━━〔 🛍️ *BUG SHOP* 〕━━━╮\n` +
    `┃\n` +
    `┃ 🛒 Bem-vindo à Bug Shop!\n` +
    `┃\n` +
    `┃ Escolha uma categoria (responde\n` +
    `┃ só com o número):\n` +
    `┃\n` +
    `${lines}\n` +
    `┃\n` +
    `┃ 0️⃣ Cancelar\n` +
    `╰━━━━━━━━━━━━━━━━━━━━━━╯`
  );
}

export function categoryScreen(category) {
  const lines = category.products.map((p, i) => `┃ ${i + 1}️⃣ ${p.label}\n┃    ${formatKz(p.price)}`).join("\n\n");
  return (
    `╭━━━〔 ${category.label} 〕━━━╮\n` +
    `┃\n` +
    `${lines}\n` +
    `┃\n` +
    `┃ 0️⃣ ↩️ Voltar\n` +
    `╰━━━━━━━━━━━━━━━━━━━━━━╯`
  );
}

export function productScreen(product) {
  return (
    `🛒 *COMPRA*\n\n` +
    `Produto: ${product.label}\n` +
    `Preço: *${formatKz(product.price)}*\n\n` +
    `1️⃣ 🛒 COMPRAR\n` +
    `2️⃣ ℹ️ INFORMAÇÕES\n` +
    `0️⃣ ↩️ VOLTAR`
  );
}

export function infoScreen(product, category) {
  return (
    `ℹ️ *INFORMAÇÕES*\n\n` +
    `${product.label}\n` +
    `Preço: ${formatKz(product.price)}\n\n` +
    `${category.info}\n\n` +
    `_Responde 0 para voltar._`
  );
}

export function askFFIdScreen() {
  return `🎮 *ID DO FREE FIRE*\n\nEnvie agora o seu ID numérico do Free Fire.`;
}

export function invalidFFIdScreen() {
  return `❌ ID inválido. Envia só números, sem espaços (ex: 123456789).`;
}

export function orderPreviewScreen(product, ffId) {
  return (
    `╭━━〔 🧾 *PEDIDO* 〕━━╮\n` +
    `┃\n` +
    `┃ 🛍️ Produto: ${product.label}\n` +
    `┃ 🎮 ID FF: ${ffId}\n` +
    `┃ 💰 Total: *${formatKz(product.price)}*\n` +
    `┃\n` +
    `╰━━━━━━━━━━━━━━━━━━╯\n\n` +
    `Confirme o seu pedido:\n\n` +
    `1️⃣ ✅ CONFIRMAR\n` +
    `0️⃣ ❌ CANCELAR`
  );
}

export function cancelledScreen() {
  return `❌ Pedido cancelado.`;
}

export function paymentMethodScreen(order) {
  return (
    `╭━━〔 💳 *PAGAMENTO* 〕━━╮\n` +
    `┃\n` +
    `┃ Pedido: #${order.orderId}\n` +
    `┃ Valor: *${formatKz(order.price)}*\n` +
    `┃\n` +
    `┃ Escolha uma forma de pagamento:\n` +
    `╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
    `1️⃣ 💙 MULTICAIXA EXPRESS\n` +
    `2️⃣ 💚 PAYPAY`
  );
}

const PAYMENT_NUMBER_DISPLAY = "954 448 377";
const PAYMENT_NUMBER_RAW     = "954448377";
const WHATSAPP_NUMBER        = "244954448377";

export function paymentInstructionsScreen(order, methodLabel) {
  return (
    `${methodLabel}\n\n` +
    `Envie *${formatKz(order.price)}* para:\n\n` +
    `📱 ${PAYMENT_NUMBER_DISPLAY}\n\n` +
    `Pedido: #${order.orderId}\n\n` +
    `Depois de efectuar o pagamento:\n\n` +
    `1️⃣ ✅ JÁ PAGUEI`
  );
}

export function alreadyPaidScreen(order) {
  const waText = encodeURIComponent(
    `Olá Bug Shop! 👋\n\n` +
    `Pedido: #${order.orderId}\n` +
    `Produto: ${order.productLabel}\n` +
    `ID FF: ${order.ffId}\n` +
    `Valor: ${formatKz(order.price)}\n\n` +
    `Estou a enviar o comprovativo de pagamento.`
  );
  const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`;

  return (
    `╭━━〔 ✅ *PEDIDO REGISTADO* 〕━━╮\n` +
    `┃\n` +
    `┃ Pedido: #${order.orderId}\n` +
    `┃\n` +
    `┃ Agora envie o comprovativo de\n` +
    `┃ pagamento para a Bug Shop.\n` +
    `┃\n` +
    `┃ 📱 ${PAYMENT_NUMBER_DISPLAY}\n` +
    `┃\n` +
    `┃ ⚠️ Envie o comprovativo junto\n` +
    `┃ com o número do pedido.\n` +
    `┃\n` +
    `┃ ⏳ Aguarde a confirmação e a recarga.\n` +
    `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
    `📲 Abrir conversa com a Bug Shop:\n${waLink}`
  );
}

export function noActiveSessionScreen(prefix) {
  return `ℹ️ Não tens nenhuma compra em curso.\nUsa *${prefix}produtos* para começar.`;
}

export function invalidOptionScreen() {
  return `❌ Opção inválida. Responde só com o número mostrado.`;
}

export { PAYMENT_NUMBER_RAW };
