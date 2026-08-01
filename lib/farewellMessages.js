/**
 * lib/farewellMessages.js
 *
 * Modelos de mensagens de despedida usados quando um participante sai de
 * um grupo (ver handlers/onGroupParticipantsUpdate.js).
 *
 * DESIGN: cada modelo é uma função `(mentionText) => string`, guardada
 * num array. A lógica de deteção do evento nunca precisa de saber quantos
 * modelos existem nem o que cada um diz — só chama getRandomFarewell().
 *
 * PARA ADICIONAR NOVAS MENSAGENS NO FUTURO (10 → 30 → 100...):
 * basta acrescentar mais uma entrada ao array `farewellMessages` abaixo,
 * seguindo o mesmo formato. Nada mais precisa de ser alterado — nem o
 * handler, nem a probabilidade (Math.random() já se ajusta ao novo total).
 *
 * `mentionText` é sempre algo como "@244923456789" — o texto que o
 * WhatsApp transforma em menção clicável quando o JID correspondente
 * está presente no array `mentions` da mensagem.
 */

const farewellMessages = [
  // 1. O Fantasma
  (m) =>
    `👻 *Um fantasma abandonou o grupo!*\n\n` +
    `${m} saiu do grupo.\n\n` +
    `Motivo: foi lavar a louça.\n` +
    `Irá voltar?: depende da quantidade de pratos.\n\n` +
    `Quanto menos fantasmas, melhor. A Bug Shop agradece! 🗿`,

  // 2. O Pedreiro
  (m) =>
    `👷 *Um pedreiro deixou a obra!*\n\n` +
    `${m} saiu do grupo.\n\n` +
    `Motivo: foi trabalhar.\n` +
    `Irá voltar?: depende da quantidade de blocos. 🧱\n\n` +
    `A obra continua, mas a mão de obra diminuiu.`,

  // 3. O Fugitivo
  (m) =>
    `🏃 *ALGUÉM FUGIU DO GRUPO!*\n\n` +
    `${m} saiu correndo.\n\n` +
    `Motivo: desconhecido.\n` +
    `Irá voltar?: se a polícia encontrar. 🚨\n\n` +
    `Testemunhas afirmam que ele saiu sem olhar para trás.`,

  // 4. O Faxineiro
  (m) =>
    `🧹 *Um faxineiro abandonou o serviço!*\n\n` +
    `${m} saiu do grupo.\n\n` +
    `Motivo: foi limpar a casa.\n` +
    `Irá voltar?: depois que terminar a faxina.\n\n` +
    `Infelizmente, nem o grupo ficou limpo. 😭`,

  // 5. O Faminto
  (m) =>
    `🍗 *Um membro foi procurar comida!*\n\n` +
    `${m} saiu do grupo.\n\n` +
    `Motivo: fome extrema.\n` +
    `Irá voltar?: depende do tamanho do prato. 🍛\n\n` +
    `Prioridades são prioridades.`,

  // 6. O Dorminhoco
  (m) =>
    `🛌 *Um guerreiro foi dormir!*\n\n` +
    `${m} saiu do grupo.\n\n` +
    `Motivo: o sono venceu.\n` +
    `Irá voltar?: quando acordar.\n\n` +
    `Que descanse em paz... até amanhã. 😂`,

  // 7. O Endividado
  (m) =>
    `💸 *Um devedor abandonou o grupo!*\n\n` +
    `${m} saiu do grupo.\n\n` +
    `Motivo: viu a cobrança chegando.\n` +
    `Irá voltar?: quando pagar a dívida.\n\n` +
    `Coincidência? Acho que não. 👀`,

  // 8. O Sem Dados
  (m) =>
    `📵 *Um membro perdeu a conexão com a humanidade!*\n\n` +
    `${m} saiu do grupo.\n\n` +
    `Motivo: acabou o saldo/dados.\n` +
    `Irá voltar?: quando carregar.\n\n` +
    `A Unitel/Africell venceu mais uma vez. 😂`,

  // 9. O Viajante
  (m) =>
    `🧳 *Um viajante deixou o grupo!*\n\n` +
    `${m} saiu do grupo.\n\n` +
    `Destino: desconhecido.\n` +
    `Motivo: decidiu seguir novos caminhos.\n` +
    `Irá voltar?: só Deus sabe. 🙏\n\n` +
    `Boa viagem, soldado.`,

  // 10. O Misterioso
  (m) =>
    `🗿 *UM MEMBRO DESAPARECEU DOS REGISTOS!*\n\n` +
    `${m} saiu do grupo.\n\n` +
    `Motivo: classificado.\n` +
    `Irá voltar?: informação confidencial.\n\n` +
    `O grupo perdeu mais um cidadão. Seguimos normalmente. 🗿`,
];

/**
 * Escolhe um modelo aleatório e devolve o texto final com a menção
 * já inserida.
 * @param {string} mentionText — ex: "@244923456789"
 * @returns {string}
 */
export function getRandomFarewell(mentionText) {
  const pick = farewellMessages[Math.floor(Math.random() * farewellMessages.length)];
  return pick(mentionText);
}

/** Útil para logs/testes — quantos modelos existem actualmente. */
export function farewellMessageCount() {
  return farewellMessages.length;
}
