/**
 * lib/bugshop/catalog.js
 *
 * Catálogo estático da Bug Shop. Preços copiados EXACTAMENTE do pedido —
 * nunca arredondar/inventar. A entrada duplicada de "200 Diamantes por
 * 1.500 Kz" no Passe de Nível foi tratada como UM único produto, como
 * pedido.
 *
 * Para adicionar categorias/produtos no futuro: acrescentar uma entrada
 * a CATEGORIES ou ao array de products de uma categoria — nada mais no
 * projecto precisa de saber a estrutura interna disto.
 */

export const CATEGORIES = [
  {
    code: "ff",
    label: "💎 RECARGAS FREE FIRE",
    products: [
      { code: "ff1", label: "💎 65 + 13 Diamantes", price: 900 },
      { code: "ff2", label: "💎 100 + 20 Diamantes", price: 1300 },
      { code: "ff3", label: "💎 310 + 62 Diamantes", price: 3600 },
      { code: "ff4", label: "💎 520 + 104 Diamantes", price: 5500 },
      { code: "ff5", label: "💎 1.060 + 212 Diamantes", price: 11500 },
      { code: "ff6", label: "💎 2.180 + 436 Diamantes", price: 22000 },
      { code: "ff7", label: "💎 5.600 + 1.120 Diamantes", price: 52000 },
    ],
    info: "Diamantes creditados directamente na tua conta Free Fire, após confirmação do pagamento e envio do comprovativo.",
  },
  {
    code: "passe",
    label: "🎫 PASSE DE NÍVEL",
    products: [
      { code: "passe1", label: "💎 120 Diamantes", price: 1000 },
      { code: "passe2", label: "💎 200 Diamantes", price: 1500 },
      { code: "passe3", label: "💎 350 Diamantes", price: 2000 },
    ],
    info: "Diamantes para o Passe de Nível, creditados após confirmação do pagamento.",
  },
  {
    code: "assinaturas",
    label: "🎁 ASSINATURAS",
    products: [
      { code: "ass1", label: "📅 Assinatura Semanal — 💎 340 Diamantes", price: 2500 },
      { code: "ass2", label: "📅 Assinatura Mensal — 💎 1.800 Diamantes", price: 10500 },
      { code: "ass3", label: "🐷 Assinatura Económica — 💎 47 Diamantes", price: 500 },
    ],
    info: "Assinatura activada na tua conta Free Fire após confirmação do pagamento.",
  },
  {
    code: "trilha",
    label: "🚀 TRILHA DA EVOLUÇÃO",
    products: [
      { code: "trilha1", label: "🚀 3 Dias", price: 800 },
      { code: "trilha2", label: "🚀 7 Dias", price: 1500 },
      { code: "trilha3", label: "🚀 30 Dias", price: 3500 },
    ],
    info: "Trilha da Evolução activada na tua conta Free Fire após confirmação do pagamento.",
  },
  {
    code: "booyah",
    label: "🅱️ PASSE BOOYAH",
    products: [
      { code: "booyah1", label: "🅱️ Passe Booyah", price: 1500 },
    ],
    info: "Passe Booyah activado na tua conta Free Fire após confirmação do pagamento.",
  },
];

export function getCategory(code) {
  return CATEGORIES.find(c => c.code === code) || null;
}

export function getProduct(code) {
  for (const cat of CATEGORIES) {
    const p = cat.products.find(p => p.code === code);
    if (p) return { ...p, categoryCode: cat.code, categoryLabel: cat.label };
  }
  return null;
}

export function formatKz(n) {
  // Formatação manual (não usar toLocaleString: depende dos dados ICU
  // instalados no Node do servidor, e pode dar resultados inconsistentes
  // consoante o ambiente — ex: "1300 Kz" num número e "11 500 Kz" noutro,
  // como aconteceu nos testes). Separador "." a cada 3 dígitos, igual ao
  // formato usado no catálogo oficial da Bug Shop.
  const withDots = Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${withDots} Kz`;
}
