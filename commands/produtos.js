/**
 * commands/produtos.js
 *
 * Ponto de entrada do menu interativo da Bug Shop. Toda a lógica de
 * navegação vive em lib/bugshop/flow.js — este comando só arranca uma
 * sessão nova (ou reinicia, se já havia uma) e mostra o menu principal.
 * As respostas seguintes (números) são apanhadas em handlers/onMessage.js.
 */
import { startBugshop } from "../lib/bugshop/flow.js";

export default {
  name: "produtos",
  aliases: ["loja", "shop"],
  description: "Abre o menu de produtos da Bug Shop",

  async execute({ sock, jid, msg, sender }) {
    const text = startBugshop(sender);
    await sock.sendMessage(jid, { text }, { quoted: msg });
  },
};
