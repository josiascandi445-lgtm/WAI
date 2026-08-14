/**
 * Comando: .take
 * Altera o nome do pacote (autor) do sticker para o nome de quem usou o comando.
 * Responde a um sticker com .take
 *
 * CAUSA DO BUG ANTERIOR ("sticker vem vazio"): duas causas reais.
 *   1. sharp(buf) sem { animated: true } só lê o 1º frame de um webp
 *      animado — em muitos stickers animados esse frame é só a base
 *      transparente da animação, o que produzia um sticker em branco.
 *   2. withMetadata({ exif: { IFD0: {...} } }) escreve EXIF fotográfico
 *      normal — o WhatsApp NÃO lê isso para o nome do pacote/autor. O
 *      WhatsApp usa um formato de EXIF próprio (JSON com "sticker-pack-
 *      name"/"sticker-pack-publisher"), que o sharp sozinho não escreve.
 *
 * FIX: usa "wa-sticker-formatter" (já usada por muitos bots Baileys) —
 * trata da animação e do EXIF correcto num só passo.
 */
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { Sticker, StickerTypes } from "wa-sticker-formatter";

export default {
  name: "take",
  description: "Altera o nome do sticker para o teu nome (responde a um sticker com .take)",

  async execute({ sock, jid, msg, sender }) {
    const ctx    = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = ctx?.quotedMessage;
    const hasDirectSticker = !!msg.message?.stickerMessage;
    const hasQuotedSticker = !!quoted?.stickerMessage;

    if (!hasDirectSticker && !hasQuotedSticker) {
      return sock.sendMessage(jid, {
        text: "❌ Responde a um sticker com *.take* para alterar o autor."
      }, { quoted: msg });
    }

    // FIX: usava sempre o número (sender.split("@")[0]) — para JIDs @lid
    // isso nem sequer é um número de telefone real, daí parecer "estranho".
    // Agora usa o nome de exibição real do WhatsApp (pushName), que o
    // Baileys entrega sempre em quem enviou a mensagem. Só cai para o
    // número formatado se por algum motivo o pushName não vier.
    const numero = sender.split("@")[0];
    const autor = msg.pushName || `+${numero}`;
    console.log(`[take] A processar sticker para: ${autor}`);

    const loggerSilent = { info: () => {}, error: console.error, warn: () => {} };

    try {
      let buf;

      if (hasDirectSticker) {
        buf = await downloadMediaMessage(msg, "buffer", {}, {
          logger: loggerSilent,
          reuploadRequest: sock.updateMediaMessage,
        });
      } else {
        const fakeMsg = {
          key: { remoteJid: jid, id: ctx.stanzaId, participant: ctx.participant },
          message: quoted,
        };
        buf = await downloadMediaMessage(fakeMsg, "buffer", {}, {
          logger: loggerSilent,
          reuploadRequest: sock.updateMediaMessage,
        });
      }

      if (!buf || buf.length === 0) throw new Error("Falha ao descarregar sticker");

      // wa-sticker-formatter trata da animação (mantém todos os frames)
      // e escreve o EXIF no formato que o WhatsApp realmente lê.
      const sticker = new Sticker(buf, {
        pack: "WAI Bot",
        author: autor,
        type: StickerTypes.FULL,
        quality: 90,
      });

      const output = await sticker.toBuffer();

      await sock.sendMessage(jid, { sticker: output }, { quoted: msg });
      console.log(`[take] ✅ sticker reenviado com autor "${autor}"`);

    } catch (err) {
      console.error(`[take] erro: ${err.message}`);
      await sock.sendMessage(jid, {
        text: "⚠️ Não consegui processar este sticker."
      }, { quoted: msg });
    }
  }
};
