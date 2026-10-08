/**
 * rack miniature — a walnut game shelf standing in the void, one boxed board game per slot, covers facing you. Built
 * from code (covers are drawn on canvases, nothing is downloaded). Tap a box: it slides out toward you and
 * data.onPick(id) opens that game (skills/rack.js owns the list and what a pick does).
 * data: { games: [{ id, title, color, ink, motif }], onPick(id) }
 */
import { tweens } from './tabletop.js';

const BW = 0.094, BH = 0.124, BD = 0.034, GAP = 0.012, WOOD = 0.012; // a box about the size of a travel game
const PER_ROW = 4;

function cover(THREE, g) {
  const W = 384, H = Math.round(W * BH / BW), c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const bg = x.createLinearGradient(0, 0, W, H); bg.addColorStop(0, g.color); bg.addColorStop(1, shade(g.color, -0.28));
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 6; x.strokeRect(14, 14, W - 28, H - 28);
  // the motif: what is inside the box
  const cx = W / 2, cy = H * 0.42, s = W * 0.56;
  motif(x, g.motif, cx, cy, s);
  x.fillStyle = g.ink || '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `700 ${Math.round(W * (g.title.length > 9 ? 0.105 : 0.13))}px Georgia, 'Times New Roman', serif`;
  x.fillText(g.title, cx, H * 0.82);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v + (k < 0 ? v * k : (255 - v) * k))));
  return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
function disc(x, px, py, r, fill, rim) { x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fillStyle = fill; x.fill(); if (rim) { x.strokeStyle = rim; x.lineWidth = r * 0.12; x.stroke(); } }
function motif(x, m, cx, cy, s) {
  const h = s / 2;
  if (m === 'chess' || m === 'checkers') {
    const n = 4, q = s / n;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { x.fillStyle = (r + c) % 2 ? '#5a3418' : '#f1dcb4'; x.fillRect(cx - h + c * q, cy - h + r * q, q, q); }
    if (m === 'checkers') { disc(x, cx - h + q * 1.5, cy - h + q * 0.5, q * 0.36, '#8f2d22', '#2a0d08'); disc(x, cx - h + q * 2.5, cy - h + q * 3.5, q * 0.36, '#e9d8b5', '#7a6644'); disc(x, cx - h + q * 0.5, cy - h + q * 3.5, q * 0.36, '#e9d8b5', '#7a6644'); }
    else { x.fillStyle = '#111'; x.font = `${Math.round(q * 1.4)}px serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('♞', cx + q * 0.5, cy - q * 0.4); x.fillStyle = '#fff'; x.fillText('♙', cx - q * 0.7, cy + q * 0.8); }
  } else if (m === 'go') {
    x.fillStyle = '#e2b56a'; x.fillRect(cx - h, cy - h, s, s); x.strokeStyle = '#2b1a0a'; x.lineWidth = 2;
    for (let i = 0; i < 5; i++) { const p = cx - h + s * (0.1 + i * 0.2); x.beginPath(); x.moveTo(p, cy - h + s * 0.1); x.lineTo(p, cy + h - s * 0.1); x.moveTo(cx - h + s * 0.1, cy - h + s * (0.1 + i * 0.2)); x.lineTo(cx + h - s * 0.1, cy - h + s * (0.1 + i * 0.2)); x.stroke(); }
    const at = (a, b) => [cx - h + s * (0.1 + a * 0.2), cy - h + s * (0.1 + b * 0.2)];
    for (const [a, b, w] of [[1, 1, 0], [2, 2, 1], [2, 1, 0], [3, 2, 1], [1, 3, 1]]) { const [px, py] = at(a, b); disc(x, px, py, s * 0.085, w ? '#f4f1ea' : '#16171b'); }
  } else if (m === 'othello') {
    x.fillStyle = '#1f7445'; x.fillRect(cx - h, cy - h, s, s); const q = s / 4;
    [[1, 1, 0], [2, 1, 1], [1, 2, 1], [2, 2, 0]].forEach(([c, r, w]) => disc(x, cx - h + q * (c + 0.5), cy - h + q * (r + 0.5), q * 0.4, w ? '#f2efe8' : '#151619'));
  } else if (m === 'tictactoe') {
    x.strokeStyle = '#fff6e6'; x.lineWidth = 7; x.lineCap = 'round'; const q = s / 3;
    for (let i = 1; i < 3; i++) { x.beginPath(); x.moveTo(cx - h + q * i, cy - h); x.lineTo(cx - h + q * i, cy + h); x.moveTo(cx - h, cy - h + q * i); x.lineTo(cx + h, cy - h + q * i); x.stroke(); }
    x.beginPath(); x.moveTo(cx - h + q * 0.25, cy - h + q * 0.25); x.lineTo(cx - h + q * 0.75, cy - h + q * 0.75); x.moveTo(cx - h + q * 0.75, cy - h + q * 0.25); x.lineTo(cx - h + q * 0.25, cy - h + q * 0.75); x.stroke();
    x.beginPath(); x.arc(cx, cy, q * 0.28, 0, Math.PI * 2); x.stroke();
  } else if (m === 'mancala') {
    x.fillStyle = '#8a5a2c'; x.beginPath(); x.roundRect(cx - h, cy - h * 0.55, s, s * 0.55, s * 0.1); x.fill();
    for (let i = 0; i < 4; i++) for (let r = 0; r < 2; r++) { const px = cx - h + s * (0.2 + i * 0.2), py = cy - h * 0.55 + s * (0.15 + r * 0.25); disc(x, px, py, s * 0.07, '#5b3716'); disc(x, px - 3, py - 2, s * 0.022, ['#4fb3d9', '#e35d6a', '#f2c14e', '#7bd389'][(i + r) % 4]); }
  } else if (m === 'aggravation') {
    x.fillStyle = '#f3e6c8'; x.beginPath(); for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? h * 0.48 : h; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); x.fill();
    ['#d64545', '#3a78d4', '#3fa35b', '#e0b13a'].forEach((col, i) => { const a = (i / 4) * Math.PI * 2 - Math.PI / 4; disc(x, cx + Math.cos(a) * h * 0.45, cy + Math.sin(a) * h * 0.45, s * 0.06, col); });
  }
}

export default async function build(ctx, data) {
  const { THREE, root } = ctx;
  const games = data.games || [];
  const rows = Math.max(1, Math.ceil(games.length / PER_ROW));
  const innerW = PER_ROW * BW + (PER_ROW + 1) * GAP, rowH = BH + GAP * 1.6, depth = BD + 0.03;
  const W = innerW + WOOD * 2, H = rows * rowH + WOOD * (rows + 1);
  const walnut = new THREE.MeshPhysicalMaterial({ color: '#5b3a22', roughness: 0.48, clearcoat: 0.35, clearcoatRoughness: 0.35 });
  const back = new THREE.MeshPhysicalMaterial({ color: '#3a2414', roughness: 0.7 });
  const shelf = new THREE.Group(); shelf.name = 'rack'; root.add(shelf);
  const slab = (w, h, d, x, y, z, m = walnut) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; b.userData.isRack = true; shelf.add(b); return b; };
  slab(WOOD, H, depth, -W / 2 + WOOD / 2, H / 2, 0); slab(WOOD, H, depth, W / 2 - WOOD / 2, H / 2, 0);
  for (let r = 0; r <= rows; r++) slab(innerW, WOOD, depth, 0, r * (rowH + WOOD) + WOOD / 2, 0);
  slab(innerW, H, 0.004, 0, H / 2, depth / 2 - 0.002, back);
  const boxes = [], tw = tweens(), mats = [];
  games.forEach((g, i) => {
    const r = rows - 1 - Math.floor(i / PER_ROW), c = i % PER_ROW;
    const side = new THREE.MeshPhysicalMaterial({ color: shade(g.color, -0.35), roughness: 0.55, clearcoat: 0.3 });
    const front = new THREE.MeshPhysicalMaterial({ map: cover(THREE, g), roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 });
    mats.push(side, front);
    // BoxGeometry faces: +x, -x, +y, -y, +z, -z. You look from -z, so the cover is the -z face.
    const box = new THREE.Mesh(new THREE.BoxGeometry(BW, BH, BD), [side, side, side, side, side, front]);
    // you look from -z, so +x is on your left: the first game sits left
    const home = new THREE.Vector3(innerW / 2 - GAP - BW / 2 - c * (BW + GAP), WOOD + r * (rowH + WOOD) + BH / 2 + 0.0005, -0.004);
    box.position.copy(home); box.castShadow = box.receiveShadow = true;
    box.userData = { game: g.id, home };
    shelf.add(box); boxes.push(box);
  });
  let picked = null;
  ctx.onTap((hits) => {
    const h = hits.find((x) => x.object.userData.game);
    if (!h || picked) return;
    picked = h.object;
    const out = picked.userData.home.clone(); out.z -= 0.05;
    tw.add(picked, out, { dur: 0.32, hop: 0.006, done: () => {
      const id = picked.userData.game;
      tw.add(picked, picked.userData.home, { dur: 0.3, hop: 0, delay: 0.5, done: () => { picked = null; } });
      if (typeof ctx.handle.data.onPick === 'function') ctx.handle.data.onPick(id);
    } });
    ctx.requestRender();
  });
  ctx.addContactShadow({ y: 0.0005, size: Math.max(W, depth) * 2.2, opacity: 0.7, blur: 3, darkness: 0.9, exclude: [] });
  ctx.frame(shelf, { view: [0.18, 0.32, -1], pad: 0.86, ground: 'none', minZoom: 0.6, maxZoom: 1.8, light: [-0.6, 1.2, -0.8] });
  return {
    update() {},
    tick(dt) { return tw.tick(dt); },
    state() { return { boxes: boxes.map((b) => b.userData.game) }; },
    dispose() { for (const o of shelf.children) o.geometry.dispose(); for (const m of [walnut, back, ...mats]) { if (m.map) m.map.dispose(); m.dispose(); } },
  };
}
