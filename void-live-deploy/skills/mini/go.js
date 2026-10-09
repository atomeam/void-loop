/**
 * go miniature — a 9×9 kaya goban standing in the void, with slate black and shell white stones. Built from code (no
 * download). Playable: a tap calls data.onPoint(i); the card owns the rules (skills/go.js), this only shows `data`.
 * data: { size: 9, board: Array(81) of 0|1|2, last: point | -1, dead: [points], onPoint(i) }
 * Point i = row * size + col, row 0 is the far edge (row "9"), col 0 is A on your left. A newly placed stone drops in;
 * captured stones simply leave the board (the card shows the counts).
 */
import { tweens } from './tabletop.js';

const S = 0.0237, R = 0.0109, THICK = 0.034; // real 9×9 board line spacing, a size-33 stone, a table-board slab
export default async function build(ctx, data) {
  const { THREE, root, phone } = ctx;
  const N = data.size || 9, half = ((N - 1) / 2) * S, edge = half + S * 0.9;
  const mid = (N - 1) / 2;
  // you sit on the -z side looking toward +z: column A (col 0) on your left (+x), row 1 (the last row) nearest you
  const pos = (i, y) => new THREE.Vector3((mid - (i % N)) * S, y, (mid - Math.floor(i / N)) * S);
  // the top: kaya-gold wood with fine grain, black grid lines and the five star points, drawn once on a canvas
  const px = phone ? 1024 : 2048, c = document.createElement('canvas'); c.width = c.height = px;
  const g = c.getContext('2d'), k = px / (edge * 2);
  const grad = g.createLinearGradient(0, 0, px, px); grad.addColorStop(0, '#e8bf77'); grad.addColorStop(1, '#d6a55c');
  g.fillStyle = grad; g.fillRect(0, 0, px, px);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < px; y += 2 + rnd() * 5) { g.strokeStyle = `rgba(${120 + rnd() * 40},${70 + rnd() * 30},20,${0.05 + rnd() * 0.08})`; g.lineWidth = 0.6 + rnd() * 1.6; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(px * 0.3, y + rnd() * 10 - 5, px * 0.7, y + rnd() * 10 - 5, px, y + rnd() * 6 - 3); g.stroke(); }
  g.strokeStyle = '#1d140a'; g.lineWidth = Math.max(2, px / 700); g.lineCap = 'square';
  const at = (n) => (edge - half + n * S) * k;
  for (let n = 0; n < N; n++) { g.beginPath(); g.moveTo(at(0), at(n)); g.lineTo(at(N - 1), at(n)); g.moveTo(at(n), at(0)); g.lineTo(at(n), at(N - 1)); g.stroke(); }
  g.fillStyle = '#1d140a';
  for (const [r, q] of N === 9 ? [[2, 2], [2, 6], [4, 4], [6, 2], [6, 6]] : []) { g.beginPath(); g.arc(at(q), at(r), px / 260, 0, Math.PI * 2); g.fill(); }
  const topMap = new THREE.CanvasTexture(c); topMap.colorSpace = THREE.SRGBColorSpace; topMap.anisotropy = 8;
  const topMat = new THREE.MeshPhysicalMaterial({ map: topMap, roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.5 });
  const sideMat = new THREE.MeshPhysicalMaterial({ color: '#c08a45', roughness: 0.6, clearcoat: 0.2 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(edge * 2, THICK, edge * 2), [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);
  board.position.y = THICK / 2; board.castShadow = board.receiveShadow = true; board.userData.isBoard = true; board.name = 'goban';
  root.add(board);
  const TOP = THICK;
  // biconvex stones: slate black (matte) and clamshell white (a soft sheen)
  const stoneGeo = new THREE.SphereGeometry(R, 48, 24).scale(1, 0.42, 1);
  const mats = {
    1: new THREE.MeshPhysicalMaterial({ color: '#141518', roughness: 0.62, clearcoat: 0.15 }),
    2: new THREE.MeshPhysicalMaterial({ color: '#f3efe6', roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.25, sheen: 0.4, sheenColor: '#ffffff' }),
  };
  const deadMats = { 1: mats[1].clone(), 2: mats[2].clone() };
  for (const m of Object.values(deadMats)) { m.transparent = true; m.opacity = 0.38; }
  const markGeo = new THREE.TorusGeometry(R * 0.38, R * 0.07, 10, 40).rotateX(Math.PI / 2);
  const markMat = new THREE.MeshStandardMaterial({ color: '#d9534f', roughness: 0.5 });
  const stones = new THREE.Group(); stones.name = 'stones'; root.add(stones);
  const tw = tweens();
  let shown = Array(N * N).fill(0), objs = Array(N * N).fill(null), mark = null;
  function paint(d) {
    const b = d.board || [], dead = new Set(d.dead || []);
    for (let i = 0; i < N * N; i++) {
      const v = b[i] || 0;
      if (v !== shown[i]) {
        if (objs[i]) { stones.remove(objs[i]); objs[i] = null; }
        if (v) {
          const m = new THREE.Mesh(stoneGeo, mats[v]); m.castShadow = m.receiveShadow = true; m.userData.p = i; m.rotation.y = rnd() * Math.PI;
          const to = pos(i, TOP + R * 0.42);
          if (i === d.last) { m.position.copy(pos(i, TOP + 0.03)); tw.add(m, to, { dur: 0.22, hop: 0 }); } else m.position.copy(to);
          stones.add(m); objs[i] = m;
        }
        shown[i] = v;
      }
      if (objs[i]) objs[i].material = dead.has(i) ? deadMats[v] : mats[v];
    }
    if (mark) { if (mark.parent) mark.parent.remove(mark); mark = null; } // the ring sits on the last stone; take it off the old one
    if (d.last >= 0 && objs[d.last]) { mark = new THREE.Mesh(markGeo, markMat); mark.position.set(0, R * 0.43, 0); objs[d.last].add(mark); }
  }
  paint(data);
  // a tap: the stone it hit, or the nearest point on the board top
  ctx.onTap((hits) => {
    let p = -1;
    for (const h of hits) {
      if (h.object.userData.p !== undefined) { p = h.object.userData.p; break; }
      if (h.object.userData.isBoard) {
        const l = board.worldToLocal(h.point.clone()), col = Math.round(mid - l.x / S), row = Math.round(mid - l.z / S);
        if (col >= 0 && col < N && row >= 0 && row < N) p = row * N + col;
        break;
      }
    }
    if (p >= 0 && typeof ctx.handle.data.onPoint === 'function') ctx.handle.data.onPoint(p);
  });
  ctx.addContactShadow({ y: 0.0005, size: edge * 3.2, opacity: 0.7, blur: 3.2, darkness: 0.9, exclude: [] }); // standing in the void: its own soft shadow
  ctx.addContactShadow({ y: TOP + 0.0002, size: edge * 2, height: 0.012, opacity: 0.7, blur: 2, darkness: 1.1, exclude: [board], res: phone ? 512 : 1024 });
  ctx.frame(board, { view: [0, 1.25, -1], pad: 0.78, ground: 'none', minZoom: 0.5, maxZoom: 1.6, light: [-0.55, 1.4, -0.4] });
  return {
    update(d) { paint(d); ctx.requestRender(); },
    tick(dt) { return tw.tick(dt); },
    state() { return { stones: stones.children.length, shown: shown.slice() }; },
    dispose() { stoneGeo.dispose(); markGeo.dispose(); board.geometry.dispose(); topMap.dispose(); for (const m of [topMat, sideMat, markMat, ...Object.values(mats), ...Object.values(deadMats)]) m.dispose(); },
  };
}
