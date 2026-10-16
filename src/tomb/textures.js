// Temple textures drawn in code (no image files): carved sandstone walls, worn flagstones and rough
// boulder rock. Each comes with a normal map made from its height, so light from torches and
// crystals catches the edges, cracks and carvings.
import * as THREE from 'three';

// small seeded random + smooth value noise
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function makeNoise(seed, size = 64) {
  const r = rng(seed), g = new Float32Array(size * size);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const at = (x, y) => g[((y % size + size) % size) * size + ((x % size + size) % size)];
  const sm = (t) => t * t * (3 - 2 * t);
  const n = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  // fractal noise that tiles every `period` units
  return (x, y, oct = 4, period = 8) => {
    let v = 0, amp = 0.5, f = 1;
    for (let o = 0; o < oct; o++) {
      const p = period * f;
      v += amp * n(((x * f) % p + p) % p, ((y * f) % p + p) % p);
      amp *= 0.5; f *= 2;
    }
    return v;
  };
}

const mix = (a, b, t) => a + (b - a) * t;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// colour + height -> textures
function finish(size, rgb, height, strength) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    img.data[i * 4] = rgb[i * 3]; img.data[i * 4 + 1] = rgb[i * 3 + 1]; img.data[i * 4 + 2] = rgb[i * 3 + 2]; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const n = document.createElement('canvas'); n.width = n.height = size;
  const ng = n.getContext('2d'), nimg = ng.createImageData(size, size);
  const h = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (h(x + 1, y) - h(x - 1, y)) * strength, dy = (h(x, y + 1) - h(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
    nimg.data[i] = (-dx / l * 0.5 + 0.5) * 255; nimg.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; nimg.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; nimg.data[i + 3] = 255;
  }
  ng.putImageData(nimg, 0, 0);
  const map = new THREE.CanvasTexture(c), normalMap = new THREE.CanvasTexture(n);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const t of [map, normalMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
  return { map, normalMap };
}

// carved glyph panels: square Maya-like signs drawn as strokes, used as a mask
function glyphMask(size, cells, seed) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), r = rng(seed);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [x, y, w] of cells) {
    const p = w * 0.14, s = w - p * 2, lw = Math.max(2, w * 0.05);
    g.lineWidth = lw;
    g.strokeRect(x + p, y + p, s, s);                              // the sign's frame
    const kind = Math.floor(r() * 5);
    const cx = x + w / 2, cy = y + w / 2;
    if (kind === 0) { // face in profile: eye, nose step, mouth
      g.beginPath(); g.arc(cx - s * 0.1, cy - s * 0.12, s * 0.09, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(cx + s * 0.25, cy - s * 0.3); g.lineTo(cx + s * 0.25, cy); g.lineTo(cx + s * 0.05, cy); g.lineTo(cx + s * 0.05, cy + s * 0.2); g.lineTo(cx + s * 0.3, cy + s * 0.2); g.stroke();
    } else if (kind === 1) { // stepped spiral
      g.beginPath(); g.moveTo(cx - s * 0.3, cy + s * 0.3); g.lineTo(cx - s * 0.3, cy - s * 0.3); g.lineTo(cx + s * 0.3, cy - s * 0.3); g.lineTo(cx + s * 0.3, cy + s * 0.15); g.lineTo(cx - s * 0.12, cy + s * 0.15); g.lineTo(cx - s * 0.12, cy - s * 0.1); g.lineTo(cx + s * 0.1, cy - s * 0.1); g.stroke();
    } else if (kind === 2) { // sun: ring and rays
      g.beginPath(); g.arc(cx, cy, s * 0.17, 0, Math.PI * 2); g.stroke();
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.beginPath(); g.moveTo(cx + Math.cos(a) * s * 0.25, cy + Math.sin(a) * s * 0.25); g.lineTo(cx + Math.cos(a) * s * 0.36, cy + Math.sin(a) * s * 0.36); g.stroke(); }
    } else if (kind === 3) { // dots and bars (numbers)
      for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(cx + (k - 1) * s * 0.2, cy - s * 0.2, s * 0.06, 0, Math.PI * 2); g.fill(); }
      g.fillRect(cx - s * 0.32, cy, s * 0.64, s * 0.08); g.fillRect(cx - s * 0.32, cy + s * 0.17, s * 0.64, s * 0.08);
    } else { // serpent: wavy line with a head
      g.beginPath();
      for (let k = 0; k <= 12; k++) { const t = k / 12, px = cx - s * 0.32 + t * s * 0.6, py = cy + Math.sin(t * Math.PI * 2) * s * 0.18; k ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.stroke(); g.beginPath(); g.arc(cx + s * 0.3, cy, s * 0.07, 0, Math.PI * 2); g.fill();
    }
  }
  return g.getImageData(0, 0, size, size).data;
}

/** Big sandstone blocks, some carved with glyphs, moss creeping up from the floor. */
export function stoneWall(size = 512) {
  const noise = makeNoise(7), r = rng(11);
  const rgb = new Uint8ClampedArray(size * size * 3), height = new Float32Array(size * size);
  const rows = 4, rowH = size / rows;
  const blocks = [];   // per row, block edges and a tint
  const glyphCells = [];
  for (let row = 0; row < rows; row++) {
    const edges = [0]; let x = (row % 2) * size * 0.18;
    if (x) edges.push(x);
    while (x < size) { x += size * (0.22 + r() * 0.2); if (x < size - size * 0.08) edges.push(x); else break; }
    edges.push(size);
    const tints = edges.map(() => ({ t: r(), carved: r() < 0.3 }));
    blocks.push({ edges, tints });
    for (let i = 0; i < edges.length - 1; i++) if (tints[i].carved && row < rows - 1) {
      const w = edges[i + 1] - edges[i], cw = Math.min(rowH * 0.8, w * 0.8), n = Math.max(1, Math.floor(w / cw));
      for (let k = 0; k < n; k++) glyphCells.push([edges[i] + (w - n * cw) / 2 + k * cw, row * rowH + (rowH - cw) / 2, cw]);
    }
  }
  const glyph = glyphMask(size, glyphCells, 5);
  const light = hex('#9c7b55'), dark = hex('#5a4129'), moss = hex('#3d4a24');
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / rowH), ry = y - row * rowH, { edges, tints } = blocks[row];
    for (let x = 0; x < size; x++) {
      let b = 0; while (b < edges.length - 2 && x >= edges[b + 1]) b++;
      const bx = Math.min(x - edges[b], edges[b + 1] - x), by = Math.min(ry, rowH - ry);
      const edge = Math.min(bx, by);
      const grain = noise(x / size * 8, y / size * 8, 5, 8);
      const chip = noise(x / size * 32 + 5, y / size * 32, 2, 32);
      const gap = 4 + chip * 6;
      let h = edge < gap ? edge / gap * 0.4 : 0.55 + Math.min(1, (edge - gap) / 14) * 0.3 + grain * 0.25;
      const i = y * size + x;
      const carve = glyph[i * 4 + 3] / 255;
      h -= carve * 0.35;
      height[i] = h;
      const t = tints[b].t, shade = 0.65 + grain * 0.55 - carve * 0.35 - (edge < gap ? 0.35 : 0);
      const mossAmt = Math.max(0, (y / size - 0.55) * 2.2) * Math.max(0, noise(x / size * 6 + 3, y / size * 6, 4, 6) * 1.8 - 0.75) + (edge < gap ? 0.12 : 0);
      for (let c = 0; c < 3; c++) {
        let v = mix(dark[c], light[c], t * 0.7 + 0.15) * shade;
        v = mix(v, moss[c] * (0.7 + grain), Math.min(1, mossAmt));
        rgb[i * 3 + c] = v;
      }
    }
  }
  return finish(size, rgb, height, 2.4);
}

/** Large worn flagstones with cracks and dust in the joints. */
export function stoneFloor(size = 512) {
  const noise = makeNoise(21), r = rng(31);
  const rgb = new Uint8ClampedArray(size * size * 3), height = new Float32Array(size * size);
  const cells = 2, cs = size / cells;
  const tint = Array.from({ length: cells * cells }, () => r());
  const base = hex('#7b6246'), dust = hex('#a88a62');
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    // wobble the grid so slabs aren't perfect squares
    const wx = x + (noise(y / size * 4, 1, 3, 4) - 0.5) * 18, wy = y + (noise(1, x / size * 4, 3, 4) - 0.5) * 18;
    const cx = ((Math.floor(wx / cs) % cells) + cells) % cells, cy = ((Math.floor(wy / cs) % cells) + cells) % cells;
    const ex = Math.min(((wx % cs) + cs) % cs, cs - (((wx % cs) + cs) % cs)), ey = Math.min(((wy % cs) + cs) % cs, cs - (((wy % cs) + cs) % cs));
    const edge = Math.min(ex, ey);
    const grain = noise(x / size * 10, y / size * 10, 5, 10);
    const crack = Math.abs(noise(x / size * 4 + 9, y / size * 4, 2, 4) - 0.5) < 0.01 && noise(x / size * 2 + 3, y / size * 2 + 5, 2, 2) > 0.58 ? 1 : 0;
    const gap = 5;
    const i = y * size + x;
    height[i] = (edge < gap ? edge / gap * 0.35 : 0.6 + grain * 0.3 - Math.min(1, edge / cs) * 0.08) - crack * 0.3;
    const t = tint[cy * cells + cx];
    const shade = 0.7 + grain * 0.5 + t * 0.15 - crack * 0.4;
    const d = edge < gap ? 0.55 : Math.max(0, noise(x / size * 4, y / size * 4 + 7, 3, 4) - 0.55);
    for (let c = 0; c < 3; c++) rgb[i * 3 + c] = mix(base[c] * shade, dust[c] * 0.8, Math.min(1, d));
  }
  return finish(size, rgb, height, 2.0);
}

/** Rough, pitted rock for the boulder and rubble. */
export function rock(size = 256) {
  const noise = makeNoise(41);
  const rgb = new Uint8ClampedArray(size * size * 3), height = new Float32Array(size * size);
  const a = hex('#8a7255'), b = hex('#4e3d2c');
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = noise(x / size * 6, y / size * 6, 5, 6), pit = noise(x / size * 20, y / size * 20, 2, 20);
    const i = y * size + x;
    height[i] = n - (pit > 0.7 ? (pit - 0.7) * 2 : 0);
    for (let c = 0; c < 3; c++) rgb[i * 3 + c] = mix(b[c], a[c], n) * (pit > 0.7 ? 0.7 : 1);
  }
  return finish(size, rgb, height, 3);
}

/** A soft round glow (for flames, dust and light), white so it can be tinted. */
export function glow(size = 64) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A flame shape: hot white-yellow core fading to orange, for flickering fire sprites. */
export function flame(size = 64) {
  const c = document.createElement('canvas'); c.width = size; c.height = size * 2;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size * 1.45, 0, size / 2, size * 1.2, size * 0.9);
  gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.25, 'rgba(255,200,90,.95)'); gr.addColorStop(0.6, 'rgba(255,110,20,.5)'); gr.addColorStop(1, 'rgba(255,60,0,0)');
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(size / 2, 0);
  g.bezierCurveTo(size * 0.95, size * 0.9, size, size * 1.6, size / 2, size * 1.95);
  g.bezierCurveTo(0, size * 1.6, size * 0.05, size * 0.9, size / 2, 0);
  g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
