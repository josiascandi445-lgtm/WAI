/**
 * lib/stickerStyles.js
 *
 * Os 10 estilos de TEXTO do .stext. Cada estilo junta uma fonte real
 * (ficheiro .ttf, ver lib/stickerFonts.js) com uma combinação de
 * preenchimento/contorno — para além da forma das letras mudar, a cor
 * também ajuda a diferenciar visualmente os 10 estilos entre si.
 */

export const STYLES = [
  { id: 1,  name: "Poster",       file: "Anton-Regular.ttf",           fill: "#FFFFFF", stroke: "#000000", strokeWidth: 14 },
  { id: 2,  name: "Comic",        file: "Bangers-Regular.ttf",         fill: "#FFE600", stroke: "#000000", strokeWidth: 12 },
  { id: 3,  name: "Urbano",       file: "BebasNeue-Regular.ttf",       fill: "#FFFFFF", stroke: "#000000", strokeWidth: 10 },
  { id: 4,  name: "Marcador",     file: "PermanentMarker-Regular.ttf", fill: "#FF2D55", stroke: "#FFFFFF", strokeWidth: 8  },
  { id: 5,  name: "Horror",       file: "Creepster-Regular.ttf",       fill: "#7CFF6B", stroke: "#000000", strokeWidth: 10 },
  { id: 6,  name: "Pixel",        file: "PressStart2P-Regular.ttf",    fill: "#00E5FF", stroke: "#000000", strokeWidth: 6  },
  { id: 7,  name: "Elegante",     file: "Lobster-Regular.ttf",         fill: "#FFD700", stroke: "#5A1E00", strokeWidth: 6  },
  { id: 8,  name: "Arredondado",  file: "Righteous-Regular.ttf",       fill: "#FF6EC7", stroke: "#000000", strokeWidth: 10 },
  { id: 9,  name: "Street",       file: "Bungee-Regular.ttf",          fill: "#FFFFFF", stroke: "#E63946", strokeWidth: 10 },
  { id: 10, name: "Cartoon",      file: "LuckiestGuy-Regular.ttf",     fill: "#FFFFFF", stroke: "#1B1B1B", strokeWidth: 14 },
];

export function getStyle(id) {
  return STYLES.find(s => s.id === id) || STYLES[0];
}
