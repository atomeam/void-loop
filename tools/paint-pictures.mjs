// The /paint/ picture library (2026-10-28): original drawings, made here from plain shapes, so every picture is ours to give away (public
// domain, CC0) and no artwork is copied. Each scene is a list of shapes painted in order onto a 220 x 220 grid of colour numbers; areas too
// small to carry a number are merged into their largest neighbour, so every area on the sheet shows its number. The two masterpieces
// (wave.json, starry.json) were cut from public-domain paintings earlier and are kept as they are; this file lists them in the index too.
//   node tools/paint-pictures.mjs           write void-live-deploy/paint/templates/<id>.json and index.json
//   node tools/paint-pictures.mjs --check   exit 1 when a written file differs from what this file makes
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), dir = path.join(root, 'void-live-deploy', 'paint', 'templates');
const W = 220, H = 220, MIN = 46;
const D = Math.PI / 180;

// shapes: each is a test (x, y) => inside
const rect = (x, y, w, h) => (px, py) => px >= x && px < x + w && py >= y && py < y + h;
const circ = (cx, cy, r) => (px, py) => (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
const ell = (cx, cy, rx, ry, rot = 0) => { const c = Math.cos(rot * D), s = Math.sin(rot * D); return (px, py) => { const dx = px - cx, dy = py - cy, u = dx * c + dy * s, v = -dx * s + dy * c; return (u / rx) ** 2 + (v / ry) ** 2 <= 1; }; };
const poly = (pts) => (px, py) => { let inside = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside; } return inside; };
const ring = (cx, cy, r0, r1) => (px, py) => { const d = Math.hypot(px - cx, py - cy); return d >= r0 && d <= r1; };
const wedge = (cx, cy, r0, r1, a0, a1) => (px, py) => { const d = Math.hypot(px - cx, py - cy); if (d < r0 || d > r1) return false; let a = Math.atan2(py - cy, px - cx) / D; a = (a + 360) % 360; const lo = (a0 + 360) % 360, hi = (a1 + 360) % 360; return lo <= hi ? a >= lo && a <= hi : a >= lo || a <= hi; };
const below = (f) => (px, py) => py >= f(px);
const and = (...fs) => (px, py) => fs.every((f) => f(px, py));
const not = (f) => (px, py) => !f(px, py);
const tri = (a, b, c) => poly([a, b, c]);

/** the scenes: id, name, category, palette, then [colour, shape] painted in order over colour 0 */
export const SCENES = [
  { id: 'sunset', name: 'Sunset over the hills', cat: 'Nature', palette: ['#3b2a63', '#8e4d8f', '#e0708a', '#f6a96b', '#ffe08a', '#c25b7a', '#6a3d6e', '#3f2b52', '#f3c1c9'],
    shapes: [[1, rect(0, 45, 220, 40)], [2, rect(0, 85, 220, 28)], [3, rect(0, 113, 220, 30)], [4, circ(110, 128, 30)], [8, ell(52, 40, 34, 9)], [8, ell(170, 62, 30, 8)], [8, ell(140, 28, 20, 6)],
      [5, below((x) => 128 + 14 * Math.sin(x / 26))], [6, below((x) => 152 + 16 * Math.sin(x / 34 + 2))], [7, below((x) => 184 + 10 * Math.sin(x / 22 + 1))]] },
  { id: 'meadow-flower', name: 'Flower in a pot', cat: 'Nature', palette: ['#e8f1f7', '#f28ab2', '#c94f86', '#ffd44f', '#e59d2c', '#4f9a4a', '#77c06a', '#c8693e', '#9b4a2a', '#d9e8c4'],
    shapes: [[9, rect(0, 168, 220, 52)], [5, rect(106, 96, 8, 92)], [6, ell(82, 136, 26, 10, -30)], [6, ell(140, 124, 26, 10, 30)],
      ...Array.from({ length: 8 }, (_, i) => [1, ell(110 + 30 * Math.cos(i * 45 * D), 72 + 30 * Math.sin(i * 45 * D), 22, 12, i * 45)]),
      ...Array.from({ length: 8 }, (_, i) => [2, ell(110 + 16 * Math.cos((i * 45 + 22) * D), 72 + 16 * Math.sin((i * 45 + 22) * D), 12, 7, i * 45 + 22)]),
      [3, circ(110, 72, 14)], [4, circ(110, 72, 7)], [7, poly([[74, 178], [146, 178], [136, 216], [84, 216]])], [8, rect(68, 166, 84, 14)]] },
  { id: 'mountain-lake', name: 'Mountain lake', cat: 'Nature', palette: ['#bfe1f2', '#fff3b0', '#7d8fb3', '#ffffff', '#4e6187', '#2f6b4f', '#4b8fc0', '#7fb7da', '#86b65a', '#9fd0ea'],
    shapes: [[9, rect(0, 70, 220, 40)], [1, circ(170, 40, 18)], [2, poly([[0, 130], [50, 52], [96, 130]])], [2, poly([[70, 130], [140, 40], [220, 130]])], [3, poly([[50, 52], [38, 72], [52, 68], [62, 72]])], [3, poly([[140, 40], [124, 62], [140, 56], [156, 62]])],
      [4, poly([[0, 140], [36, 96], [80, 140]])], [4, poly([[130, 140], [184, 88], [220, 120], [220, 140]])], [6, rect(0, 140, 220, 50)], [7, ell(110, 160, 60, 6)], [7, ell(60, 176, 40, 4)], [8, rect(0, 190, 220, 30)],
      ...[18, 40, 176, 200].map((x) => [5, tri([x, 110], [x - 14, 150], [x + 14, 150])])] },
  { id: 'tree', name: 'Autumn tree', cat: 'Nature', palette: ['#f4ead8', '#7a4b2a', '#e4572e', '#f3a712', '#c1292e', '#ffcf56', '#8fb26b', '#5a7d3a', '#d9c7a7'],
    shapes: [[8, rect(0, 186, 220, 34)], [6, ell(110, 196, 110, 14)], [1, poly([[100, 200], [120, 200], [116, 120], [104, 120]])], [1, poly([[106, 140], [70, 104], [76, 98], [112, 130]])], [1, poly([[114, 134], [150, 98], [156, 104], [118, 146]])],
      [2, circ(80, 86, 34)], [3, circ(140, 80, 36)], [4, circ(110, 58, 34)], [5, circ(64, 120, 18)], [3, circ(160, 120, 18)], [5, circ(120, 98, 16)], [4, circ(40, 190, 7)], [2, circ(180, 188, 7)], [7, ell(30, 200, 20, 6)], [7, ell(196, 202, 22, 6)]] },
  { id: 'cat', name: 'Sleepy cat', cat: 'Animals', palette: ['#dfe9f5', '#f29e4c', '#f7c6c7', '#7bc67b', '#26232b', '#fff7ec', '#c96d22', '#8aa0c6'],
    shapes: [[7, rect(0, 176, 220, 44)], [1, ell(124, 160, 66, 40)], [1, ell(190, 186, 26, 10, -20)], [1, circ(84, 104, 46)], [1, tri([46, 84], [52, 36], [86, 66])], [1, tri([122, 84], [116, 36], [82, 66])], [2, tri([54, 72], [57, 48], [74, 66])], [2, tri([114, 72], [111, 48], [94, 66])],
      [6, poly([[70, 60], [84, 58], [98, 60], [92, 74], [76, 74]])], [6, ell(150, 140, 10, 26, 20)], [6, ell(118, 136, 9, 24, 10)], [5, ell(72, 124, 18, 13)], [5, ell(96, 124, 18, 13)], [3, ell(66, 102, 9, 7)], [3, ell(102, 102, 9, 7)], [4, ell(66, 102, 3, 7)], [4, ell(102, 102, 3, 7)], [2, tri([78, 114], [90, 114], [84, 122])]] },
  { id: 'fish', name: 'Tropical fish', cat: 'Animals', palette: ['#5ab3e0', '#ff8c42', '#ffffff', '#ffb37a', '#1d2433', '#a6dcf2', '#3c9a5f', '#f2d49b', '#2c7fb8'],
    shapes: [[8, below((x) => 150 + 8 * Math.sin(x / 18))], [7, below((x) => 192 + 6 * Math.sin(x / 15))], [6, poly([[30, 196], [22, 120], [36, 90], [40, 140], [44, 196]])], [6, poly([[186, 196], [180, 130], [196, 100], [198, 150], [200, 196]])],
      [1, poly([[160, 100], [196, 66], [196, 134]])], [3, poly([[96, 60], [130, 40], [140, 72]])], [3, poly([[100, 136], [126, 156], [130, 128]])], [1, ell(110, 100, 58, 36)], [2, and(ell(110, 100, 58, 36), rect(80, 50, 14, 100))], [2, and(ell(110, 100, 58, 36), rect(118, 50, 14, 100))],
      [2, circ(72, 92, 10)], [4, circ(70, 92, 5)], [5, ring(150, 40, 6, 10)], [5, ring(164, 22, 4, 8)], [5, ring(40, 50, 5, 9)]] },
  { id: 'owl', name: 'Night owl', cat: 'Animals', palette: ['#1f2a4d', '#f5e6a8', '#6b4423', '#9a6b43', '#e3c59a', '#ffffff', '#f2b134', '#1a1a1a', '#e07a2c'],
    shapes: [[1, circ(178, 40, 22)], ...[[30, 30], [70, 18], [120, 36], [36, 82], [196, 96]].map(([x, y]) => [1, circ(x, y, 4)]), [2, poly([[0, 176], [220, 166], [220, 182], [0, 192]])],
      [3, ell(110, 120, 52, 62)], [3, tri([64, 70], [70, 34], [94, 62])], [3, tri([156, 70], [150, 34], [126, 62])], [4, ell(110, 146, 32, 34)], [5, circ(88, 96, 20)], [5, circ(132, 96, 20)], [6, circ(88, 96, 12)], [6, circ(132, 96, 12)], [7, circ(88, 96, 5)], [7, circ(132, 96, 5)],
      [8, tri([102, 112], [118, 112], [110, 128])], [8, ell(94, 182, 9, 5)], [8, ell(126, 182, 9, 5)]] },
  { id: 'butterfly', name: 'Butterfly', cat: 'Animals', palette: ['#e3f4df', '#8e5bd1', '#4aa3df', '#ffd23f', '#ffffff', '#2b2235', '#ef7aa8', '#5fae5a'],
    shapes: [[7, rect(0, 196, 220, 24)], [6, circ(30, 186, 10)], [6, circ(190, 190, 10)], [3, circ(30, 186, 4)], [3, circ(190, 190, 4)],
      [1, ell(72, 76, 44, 30, -35)], [1, ell(148, 76, 44, 30, 35)], [2, ell(80, 132, 32, 22, 30)], [2, ell(140, 132, 32, 22, -30)], [3, circ(64, 70, 14)], [3, circ(156, 70, 14)], [4, circ(80, 134, 9)], [4, circ(140, 134, 9)], [6, circ(48, 92, 7)], [6, circ(172, 92, 7)],
      [5, ell(110, 106, 7, 46)], [5, circ(110, 58, 9)], [5, circ(94, 30, 5)], [5, circ(126, 30, 5)]] },
  { id: 'house', name: 'Little house', cat: 'Places', palette: ['#b9e0f7', '#78b85a', '#f2d3a2', '#c4473a', '#6b3e26', '#fff3a6', '#ffd23f', '#d9b48a', '#3f8a3a', '#ffffff'],
    shapes: [[1, rect(0, 168, 220, 52)], [9, ell(40, 36, 26, 10)], [9, ell(176, 50, 22, 8)], [6, circ(186, 26, 16)], [3, rect(136, 56, 14, 30)], [2, rect(50, 98, 110, 80)], [3, tri([40, 100], [105, 46], [170, 100])], [4, rect(92, 128, 26, 50)],
      [5, rect(60, 112, 24, 22)], [5, rect(126, 112, 24, 22)], [7, poly([[92, 178], [118, 178], [140, 220], [72, 220]])], [4, rect(186, 120, 10, 52)], [8, circ(191, 106, 22)], [8, circ(24, 150, 16)]] },
  { id: 'lighthouse', name: 'Lighthouse', cat: 'Places', palette: ['#25335c', '#4b5f94', '#ffe27a', '#ffffff', '#d64045', '#2a6f97', '#1d4e6e', '#5c5c66', '#f6f1d1'],
    shapes: [[1, rect(0, 90, 220, 70)], [2, poly([[110, 38], [220, 10], [220, 50]])], [2, poly([[110, 38], [0, 10], [0, 50]])], [8, circ(40, 120, 14)], [5, rect(0, 160, 220, 60)], [6, below((x) => 190 + 6 * Math.sin(x / 14))],
      [7, poly([[60, 220], [80, 168], [150, 162], [176, 220]])], [3, poly([[92, 170], [128, 170], [120, 56], [100, 56]])], [4, and(poly([[92, 170], [128, 170], [120, 56], [100, 56]]), (x, y) => Math.floor((y - 56) / 22) % 2 === 1)],
      [4, rect(94, 44, 32, 6)], [2, rect(100, 26, 20, 18)], [4, tri([96, 26], [124, 26], [110, 12])]] },
  { id: 'sailboat', name: 'Sailboat', cat: 'Places', palette: ['#cdeaf7', '#ffe08a', '#3d8fc4', '#21608f', '#8a5a3c', '#ffffff', '#e4572e', '#f2f2f2'],
    shapes: [[1, circ(46, 44, 20)], [7, ell(160, 40, 30, 10)], [7, ell(120, 60, 18, 6)], [2, rect(0, 150, 220, 70)], [3, below((x) => 182 + 7 * Math.sin(x / 16))],
      [4, poly([[50, 140], [176, 140], [158, 166], [70, 166]])], [4, rect(110, 40, 5, 100)], [5, tri([108, 46], [108, 132], [52, 132])], [6, tri([118, 50], [118, 132], [168, 132])], [6, tri([116, 30], [116, 40], [132, 35])]] },
  { id: 'balloon', name: 'Hot air balloon', cat: 'Places', palette: ['#aee0f4', '#ffffff', '#e4572e', '#ffd23f', '#4aa3df', '#8a5a3c', '#5fae5a', '#3c7d3a'],
    shapes: [[1, ell(40, 50, 26, 9)], [1, ell(180, 90, 24, 8)], [6, below((x) => 186 + 10 * Math.sin(x / 30))], [7, below((x) => 204 + 6 * Math.sin(x / 20 + 1))],
      [2, circ(110, 80, 56)], [3, and(circ(110, 80, 56), rect(76, 0, 18, 220))], [4, and(circ(110, 80, 56), rect(102, 0, 16, 220))], [3, and(circ(110, 80, 56), rect(126, 0, 18, 220))],
      [2, poly([[70, 118], [150, 118], [124, 146], [96, 146]])], [5, rect(98, 156, 24, 18)]] },
  { id: 'rocket', name: 'Rocket to the stars', cat: 'Space', palette: ['#141b33', '#e0e6ef', '#d64045', '#7fc8f8', '#3c4a6b', '#f2b134', '#ff7a3d', '#9b6bd6', '#f6d6ff', '#fff6a8'],
    shapes: [...[[20, 20], [60, 50], [190, 24], [200, 120], [24, 140], [170, 190], [40, 200]].map(([x, y]) => [9, circ(x, y, 4)]), [7, circ(170, 70, 26)], [8, ell(170, 70, 44, 8, -20)], [7, and(circ(170, 70, 26), (x, y) => y < 70 - (x - 170) * 0.36)],
      [6, poly([[96, 160], [124, 160], [110, 210]])], [5, poly([[102, 160], [118, 160], [110, 190]])], [2, poly([[86, 150], [96, 120], [96, 160], [80, 164]])], [2, poly([[134, 150], [124, 120], [124, 160], [140, 164]])],
      [1, ell(110, 110, 18, 52)], [2, and(ell(110, 110, 18, 52), (x, y) => y < 74)], [4, circ(110, 106, 11)], [3, circ(110, 106, 7)]] },
  { id: 'mandala', name: 'Mandala', cat: 'Patterns', palette: ['#fdf6e3', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51', '#264653', '#8ab17d', '#b5838d', '#6d597a', '#ffcdb2'],
    shapes: [[9, circ(110, 110, 104)], ...Array.from({ length: 12 }, (_, i) => [i % 2 ? 8 : 7, wedge(110, 110, 84, 104, i * 30, i * 30 + 30)]), [5, ring(110, 110, 80, 84)],
      ...Array.from({ length: 8 }, (_, i) => [i % 2 ? 1 : 6, wedge(110, 110, 52, 80, i * 45 + 5, i * 45 + 40)]), ...Array.from({ length: 8 }, (_, i) => [2, ell(110 + 66 * Math.cos((i * 45 + 22.5) * D), 110 + 66 * Math.sin((i * 45 + 22.5) * D), 9, 5, i * 45 + 22.5)]),
      [5, ring(110, 110, 48, 52)], ...Array.from({ length: 6 }, (_, i) => [i % 2 ? 3 : 4, wedge(110, 110, 22, 48, i * 60, i * 60 + 60)]), [2, circ(110, 110, 22)], [4, circ(110, 110, 10)]] },
  { id: 'quilt', name: 'Patchwork quilt', cat: 'Patterns', palette: ['#f7f3e8', '#e07a5f', '#3d405b', '#81b29a', '#f2cc8f', '#6d9dc5', '#b56576', '#355070'],
    shapes: [...Array.from({ length: 16 }, (_, k) => { const i = k % 4, j = (k / 4) | 0, x = 10 + i * 50, y = 10 + j * 50, c1 = 1 + ((i + j) % 7), c2 = 1 + ((i * 3 + j + 2) % 7);
      return [[c1, tri([x, y], [x + 50, y], [x, y + 50])], [c2, tri([x + 50, y], [x + 50, y + 50], [x, y + 50])], [((i + j) % 2) ? 4 : 0, circ(x + 25, y + 25, 9)]]; }).flat()] },
];

/** the colour numbers of one scene, and its areas cleaned: an area under MIN pixels takes its largest neighbour's colour. Pure. */
export function rasterize(scene) {
  const L = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let c = 0; for (const [col, f] of scene.shapes) if (f(x + 0.5, y + 0.5)) c = col; L[y * W + x] = c; }
  for (let pass = 0; pass < 6; pass++) {
    const region = new Int32Array(W * H).fill(-1); let changed = false;
    for (let p = 0; p < W * H; p++) {
      if (region[p] !== -1) continue;
      const lab = L[p], st = [p], px = []; region[p] = p;
      while (st.length) { const q = st.pop(); px.push(q); const x = q % W, y = (q / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const r = ny * W + nx; if (region[r] === -1 && L[r] === lab) { region[r] = p; st.push(r); } } }
      if (px.length >= MIN) continue;
      const near = new Map();
      for (const q of px) { const x = q % W, y = (q / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const v = L[ny * W + nx]; if (v !== lab) near.set(v, (near.get(v) || 0) + 1); } }
      const best = [...near.entries()].sort((a, b) => b[1] - a[1])[0]; if (best) { for (const q of px) L[q] = best[0]; changed = true; }
    }
    if (!changed) break;
  }
  return L;
}
/** run-length pairs [colour, length]. Pure. */
export const rle = (L) => { const out = []; let prev = -1, n = 0; for (const v of L) { if (v === prev) n++; else { if (prev >= 0) out.push([prev, n]); prev = v; n = 1; } } out.push([prev, n]); return out; };

/** the palette kept to the colours the picture really uses, renumbered in order. Pure. */
function compact(scene, L) {
  const used = [...new Set(L)].sort((a, b) => a - b), map = new Map(used.map((c, i) => [c, i]));
  return { palette: used.map((c) => scene.palette[c]), labels: L.map((c) => map.get(c)) };
}

export function build() {
  const files = {}, index = [
    { id: 'wave', name: 'The Great Wave', cat: 'Masterpieces', file: '/paint/templates/wave.json', credit: 'Hokusai, public domain' },
    { id: 'starry', name: 'The Starry Night', cat: 'Masterpieces', file: '/paint/templates/starry.json', credit: 'Van Gogh, public domain' },
  ];
  for (const s of SCENES) {
    const { palette, labels } = compact(s, rasterize(s));
    files[s.id + '.json'] = JSON.stringify({ id: s.id, name: s.name, category: s.cat, credit: s.name + ': an original Verse drawing, public domain (CC0).', w: W, h: H, palette, rle: rle(labels) }) + '\n';
    index.push({ id: s.id, name: s.name, cat: s.cat, file: '/paint/templates/' + s.id + '.json', credit: 'Verse, CC0' });
  }
  files['index.json'] = JSON.stringify({ note: 'made by tools/paint-pictures.mjs', categories: ['Masterpieces', 'Animals', 'Nature', 'Places', 'Space', 'Patterns'], pictures: index }, null, 1) + '\n';
  return files;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check'), files = build(); let stale = 0;
  for (const [name, body] of Object.entries(files)) {
    const f = path.join(dir, name), now = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    if (now === body) continue;
    if (check) { console.error('stale: void-live-deploy/paint/templates/' + name + ' (run node tools/paint-pictures.mjs)'); stale++; } else fs.writeFileSync(f, body);
  }
  if (check && stale) process.exit(1);
  console.log(check ? 'paint pictures: up to date' : 'paint pictures: written ' + Object.keys(files).length + ' files');
}
