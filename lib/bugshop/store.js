/**
 * lib/bugshop/store.js
 *
 * Persistência da Bug Shop — dois ficheiros JSON separados (mesmo
 * espírito de lib/addRaceData.js: escrita atómica, tolerante a falhas):
 *
 *   data/bugshop_orders.json   → pedidos (fonte de verdade, definitivo)
 *   data/bugshop_sessions.json → em que passo cada utilizador está
 *                                 agora (navegação do menu)
 *
 * Sessões são persistidas também (não só em RAM) para que um pedido a
 * meio (ex: acabou de escolher o produto, ainda não confirmou) não se
 * perca se o bot reiniciar — requisito explícito do pedido.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname     = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR       = path.join(__dirname, "../../data");
const ORDERS_FILE    = path.join(DATA_DIR, "bugshop_orders.json");
const SESSIONS_FILE  = path.join(DATA_DIR, "bugshop_sessions.json");

export const STATUS = {
  AGUARDANDO_PAGAMENTO: "AGUARDANDO_PAGAMENTO",
  PAGAMENTO_ENVIADO:    "PAGAMENTO_ENVIADO",
  EM_ANALISE:           "EM_ANALISE",
  PAGO:                 "PAGO",
  RECARGA_REALIZADA:    "RECARGA_REALIZADA",
  CANCELADO:            "CANCELADO",
};

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`[bugshop] erro ao ler ${path.basename(file)}, a continuar vazio:`, err.message);
    return fallback;
  }
}

function writeJsonAtomic(file, data) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
  } catch (err) {
    console.error(`[bugshop] erro ao gravar ${path.basename(file)}:`, err.message);
  }
}

// ─── Pedidos ────────────────────────────────────────────────────────────

export function loadOrders() {
  return readJson(ORDERS_FILE, {});
}

export function saveOrders(orders) {
  writeJsonAtomic(ORDERS_FILE, orders);
}

export function generateOrderId(existingOrders) {
  const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem O/0/I/1, difíceis de distinguir
  let id;
  do {
    let code = "";
    for (let i = 0; i < 5; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
    id = `BS-${code}`;
  } while (existingOrders[id]);
  return id;
}

/**
 * Cria e persiste um novo pedido. Devolve o objecto do pedido (já com
 * orderId gerado).
 */
export function createOrder(fields) {
  const orders = loadOrders();
  const orderId = generateOrderId(orders);
  const now = Date.now();

  const order = {
    orderId,
    userJid: fields.userJid,
    customerName: fields.customerName || null,
    customerNumber: fields.customerNumber || null,
    productCode: fields.productCode,
    categoryCode: fields.categoryCode,
    productLabel: fields.productLabel,
    price: fields.price,
    ffId: fields.ffId,
    paymentMethod: null,
    status: STATUS.AGUARDANDO_PAGAMENTO,
    createdAt: now,
    updatedAt: now,
  };

  orders[orderId] = order;
  saveOrders(orders);
  return order;
}

export function getOrder(orderId) {
  const orders = loadOrders();
  return orders[orderId] || null;
}

/** Actualiza campos de um pedido existente (muta e persiste). Devolve o pedido actualizado, ou null se não existir. */
export function updateOrder(orderId, patch) {
  const orders = loadOrders();
  if (!orders[orderId]) return null;
  orders[orderId] = { ...orders[orderId], ...patch, updatedAt: Date.now() };
  saveOrders(orders);
  return orders[orderId];
}

// ─── Sessões de navegação ───────────────────────────────────────────────

export function loadSessions() {
  return readJson(SESSIONS_FILE, {});
}

export function saveSessions(sessions) {
  writeJsonAtomic(SESSIONS_FILE, sessions);
}

export function getSession(userJid) {
  const sessions = loadSessions();
  return sessions[userJid] || null;
}

export function setSession(userJid, session) {
  const sessions = loadSessions();
  sessions[userJid] = { ...session, updatedAt: Date.now() };
  saveSessions(sessions);
}

export function clearSession(userJid) {
  const sessions = loadSessions();
  if (sessions[userJid]) {
    delete sessions[userJid];
    saveSessions(sessions);
  }
}
