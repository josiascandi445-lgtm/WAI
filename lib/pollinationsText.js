/**
 * lib/pollinationsText.js
 *
 * Geração de texto via Pollinations.ai (https://text.pollinations.ai) —
 * o mesmo provedor gratuito, sem chave, já usado com sucesso pelo
 * .imggen (image.pollinations.ai). Reutilizado por .ai e .quote.
 *
 * NOTA: a Pollinations tem vindo a construir um novo endpoint pago
 * (gen.pollinations.ai, requer chave), mas o endpoint antigo usado aqui
 * (text.pollinations.ai) continua gratuito e sem chave — o mesmo padrão
 * que já está a funcionar no .imggen deste projecto.
 */
export async function generateText(prompt, { system, timeoutMs = 20_000 } = {}) {
  const url = new URL(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`);
  url.searchParams.set("model", "openai");
  if (system) url.searchParams.set("system", system);

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`Pollinations text devolveu HTTP ${res.status}`);

  const text = (await res.text()).trim();
  if (!text) throw new Error("Pollinations text devolveu resposta vazia");

  return text;
}
