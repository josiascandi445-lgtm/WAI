/**
 * lib/stickerBackgrounds.js
 *
 * Os 10 fundos do .stext — todos desenhados em vector (SVG), sem
 * nenhuma imagem externa. Zero risco de dependência a quebrar: isto é
 * só geometria e cor. Cada função devolve o CONTEÚDO interno de um SVG
 * 512×512 (sem a tag <svg> à volta — quem chama é o commands/stext.js,
 * que junta isto ao texto num único documento).
 */

const SIZE = 512;

function seededRandom(seed) {
  // PRNG simples e determinístico — o mesmo texto/estilo produz sempre
  // o mesmo padrão de fundo (mais previsível para depurar/testar).
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// 1. Riscas tipo "tigre" (como o exemplo ADM OFF) — diagonais irregulares P/B.
function tigerStripes() {
  let shapes = `<rect width="${SIZE}" height="${SIZE}" fill="#111111"/>`;
  const rnd = seededRandom(1);
  for (let i = -4; i < 12; i++) {
    const x = i * 70 + rnd() * 20;
    const w = 30 + rnd() * 25;
    const skew = 20 + rnd() * 15;
    shapes += `<polygon points="${x},0 ${x + w},0 ${x + w - skew},${SIZE} ${x - skew},${SIZE}" fill="#F5F5F5"/>`;
  }
  return shapes;
}

// 2. Splatter/grunge — respingos de tinta.
function splatter() {
  let shapes = `<rect width="${SIZE}" height="${SIZE}" fill="#1c1c1c"/>`;
  const rnd = seededRandom(2);
  for (let i = 0; i < 40; i++) {
    const cx = rnd() * SIZE, cy = rnd() * SIZE, r = 4 + rnd() * 22;
    shapes += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#3a3a3a"/>`;
  }
  return shapes;
}

// 3. Pontos halftone com gradiente.
function halftone() {
  let shapes = `
    <defs><linearGradient id="hg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2b1055"/><stop offset="100%" stop-color="#7597de"/>
    </linearGradient></defs>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#hg)"/>`;
  for (let y = 0; y < SIZE; y += 28) {
    for (let x = 0; x < SIZE; x += 28) {
      const r = 2 + ((x + y) % 84) / 12;
      shapes += `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" opacity="0.5"/>`;
    }
  }
  return shapes;
}

// 4. Grelha neon (retrowave).
function neonGrid() {
  let shapes = `
    <defs><linearGradient id="ng" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0f0026"/><stop offset="100%" stop-color="#3d0066"/>
    </linearGradient></defs>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#ng)"/>`;
  for (let x = 0; x <= SIZE; x += 32) {
    shapes += `<line x1="${x}" y1="0" x2="${x}" y2="${SIZE}" stroke="#ff2de0" stroke-width="1" opacity="0.35"/>`;
  }
  for (let y = 260; y <= SIZE; y += 26) {
    shapes += `<line x1="0" y1="${y}" x2="${SIZE}" y2="${y}" stroke="#00eaff" stroke-width="1" opacity="0.35"/>`;
  }
  shapes += `<circle cx="256" cy="180" r="90" fill="none" stroke="#ff2de0" stroke-width="4" opacity="0.6"/>`;
  return shapes;
}

// 5. Riscas diagonais 2 cores, limpas.
function diagonalStripes() {
  let shapes = `<rect width="${SIZE}" height="${SIZE}" fill="#ffcc00"/>`;
  for (let i = -4; i < 14; i++) {
    const x = i * 60;
    shapes += `<polygon points="${x},0 ${x + 30},0 ${x - SIZE + 30},${SIZE} ${x - SIZE},${SIZE}" fill="#111111"/>`;
  }
  return shapes;
}

// 6. Explosão tipo banda desenhada (raios a partir do centro).
function burst() {
  let shapes = `<rect width="${SIZE}" height="${SIZE}" fill="#ff3b30"/>`;
  const cx = SIZE / 2, cy = SIZE / 2, rays = 16;
  for (let i = 0; i < rays; i++) {
    const a1 = (i / rays) * Math.PI * 2;
    const a2 = a1 + Math.PI / rays;
    const r = 380;
    const x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
    const x2 = cx + Math.cos(a2) * r, y2 = cy + Math.sin(a2) * r;
    const fill = i % 2 === 0 ? "#ffd400" : "#ff9d00";
    shapes += `<polygon points="${cx},${cy} ${x1},${y1} ${x2},${y2}" fill="${fill}"/>`;
  }
  return shapes;
}

// 7. Manchas tipo camuflado.
function camo() {
  const palette = ["#4b5320", "#708238", "#3b3c36", "#8a9a5b"];
  let shapes = `<rect width="${SIZE}" height="${SIZE}" fill="${palette[0]}"/>`;
  const rnd = seededRandom(7);
  for (let i = 0; i < 22; i++) {
    const cx = rnd() * SIZE, cy = rnd() * SIZE;
    const rx = 40 + rnd() * 70, ry = 25 + rnd() * 50;
    const rot = rnd() * 360;
    const color = palette[1 + Math.floor(rnd() * 3)];
    shapes += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${color}" transform="rotate(${rot} ${cx} ${cy})"/>`;
  }
  return shapes;
}

// 8. Mesh suave de gradientes (blobs desfocados).
function softMesh() {
  return `
    <defs>
      <filter id="blur"><feGaussianBlur stdDeviation="40"/></filter>
    </defs>
    <rect width="${SIZE}" height="${SIZE}" fill="#0f172a"/>
    <circle cx="120" cy="120" r="140" fill="#38bdf8" filter="url(#blur)" opacity="0.7"/>
    <circle cx="420" cy="160" r="150" fill="#a855f7" filter="url(#blur)" opacity="0.7"/>
    <circle cx="256" cy="420" r="170" fill="#f472b6" filter="url(#blur)" opacity="0.6"/>`;
}

// 9. Triângulos geométricos.
function triangles() {
  let shapes = `<rect width="${SIZE}" height="${SIZE}" fill="#101820"/>`;
  const rnd = seededRandom(9);
  const cols = ["#1f2933", "#323f4b", "#3e4c59"];
  for (let y = -40; y < SIZE + 40; y += 60) {
    for (let x = -40; x < SIZE + 40; x += 60) {
      const up = (x / 60 + y / 60) % 2 === 0;
      const c = cols[Math.floor(rnd() * cols.length)];
      const pts = up
        ? `${x},${y + 60} ${x + 60},${y + 60} ${x + 30},${y}`
        : `${x},${y} ${x + 60},${y} ${x + 30},${y + 60}`;
      shapes += `<polygon points="${pts}" fill="${c}"/>`;
    }
  }
  return shapes;
}

// 10. Cor sólida com vinheta — limpo/minimalista.
function solidVignette() {
  return `
    <defs><radialGradient id="vg" cx="50%" cy="50%" r="75%">
      <stop offset="0%" stop-color="#2c2c2c"/><stop offset="100%" stop-color="#000000"/>
    </radialGradient></defs>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#vg)"/>`;
}

export const BACKGROUNDS = [
  { id: 1, name: "Tigre",       render: tigerStripes },
  { id: 2, name: "Respingos",   render: splatter },
  { id: 3, name: "Halftone",    render: halftone },
  { id: 4, name: "Neon",        render: neonGrid },
  { id: 5, name: "Diagonal",    render: diagonalStripes },
  { id: 6, name: "Explosão",    render: burst },
  { id: 7, name: "Camuflado",   render: camo },
  { id: 8, name: "Gradiente",   render: softMesh },
  { id: 9, name: "Triângulos",  render: triangles },
  { id: 10, name: "Minimalista", render: solidVignette },
];

export function getBackground(id) {
  return BACKGROUNDS.find(b => b.id === id) || BACKGROUNDS[0];
}
