/**
 * Comando: .play
 * FIX P6: Agora é um alias limpo de music.js — evita código duplicado.
 * Toda a lógica está centralizada em music.js.
 */
import musicCommand from "./music.js";

export default {
  ...musicCommand,
  name: "play",
  aliases: ["p"],
  description: "Toca música em áudio do YouTube (alias de .music)",
};
