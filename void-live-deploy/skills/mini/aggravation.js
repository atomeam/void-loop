/**
 * aggravation miniature — the card's own star board turned into a wooden 3D board: the top is the card's SVG (star inlay,
 * painted lanes, bases, gold shortcut rings, holes) drawn onto the wood, with glass marbles sitting in the holes. Marbles
 * you can move glow; the one you picked lifts; where it can go shows as glowing rings; a move glides hole to hole. The
 * card keeps every rule, the die and the bots (skills/aggravation.js); taps press the card's own marbles and targets.
 * data: { svg: '<svg …>' (the static board), marbles: [{ sel, x, y, color, can, picked, last }], targets: [{ sel, x, y }], onTap(selector),
 *         piece: 'pawn' for standing plastic pawns instead of glass marbles (skills/sorry.js) }
 * x, y are in the card's SVG units (-200..200, y down).
 */
import { tweens } from './tabletop.js';

const U = 0.001, HALF = 0.2, H = 0.022, MR = 0.0072; // 1 SVG unit = 1 mm: a 40 cm board, 14 mm marbles
export default async function build(ctx, data) {
  const { THREE, root, phone } = ctx;
  const at = (x, y, h) => new THREE.Vector3(-x * U, h, -y * U); // you sit at the bottom of the card's board
  // the top: the card's board drawn upside-down onto a canvas so it lands the right way round on the box top
  const px = phone ? 1024 : 2048, c = document.createElement('canvas'); c.width = c.height = px;
  const g = c.getContext('2d');
  g.fillStyle = '#b07a45'; g.fillRect(0, 0, px, px);
  const topMap = new THREE.CanvasTexture(c); topMap.colorSpace = THREE.SRGBColorSpace; topMap.anisotropy = 8;
  await new Promise((done) => {
    const img = new Image();
    img.onload = () => { g.save(); g.translate(px, px); g.rotate(Math.PI); g.drawImage(img, 0, 0, px, px); g.restore(); topMap.needsUpdate = true; done(); };
    img.onerror = () => done();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(data.svg || '<svg xmlns="http://www.w3.org/2000/svg"/>');
  });
  const topM = new THREE.MeshPhysicalMaterial({ map: topMap, roughness: 0.5, clearcoat: 0.45, clearcoatRoughness: 0.3 });
  const sideM = new THREE.MeshPhysicalMaterial({ color: '#8f5d31', roughness: 0.55, clearcoat: 0.3 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, H, HALF * 2), [sideM, sideM, topM, sideM, sideM, sideM]);
  board.position.y = H / 2; board.castShadow = board.receiveShadow = true; board.userData.isBoard = true; root.add(board);
  const pawns = data.piece === 'pawn';
  // a Sorry! pawn: turned plastic, a wide foot, a waist, a collar and a round head (about 24 mm tall)
  const pawnProfile = [[0, 0], [0.0078, 0], [0.0082, 0.0012], [0.0074, 0.0026], [0.0046, 0.0046], [0.0033, 0.0098], [0.0029, 0.0136], [0.0052, 0.0146], [0.0052, 0.0156], [0.0031, 0.0166], [0.0046, 0.0184], [0.0049, 0.0204], [0.004, 0.0226], [0.0022, 0.0238], [0, 0.0242]].map(([r, y]) => new THREE.Vector2(r, y));
  const ballGeo = pawns ? new THREE.LatheGeometry(pawnProfile, 48) : new THREE.SphereGeometry(MR, 40, 24);
  const glass = {};
  const matFor = (col) => glass[col] || (glass[col] = pawns
    ? new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.18, sheen: 0.2 })
    : new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.06, transmission: 0.45, thickness: 0.01, ior: 1.5, clearcoat: 1, clearcoatRoughness: 0.05 }));
  // where you can play has to read at a glance from across the table: a wide bright ring with a soft glow filling it
  // (drawn once per move, no animation, so waiting on you costs the GPU nothing)
  const ringGeo = new THREE.RingGeometry(MR * 1.35, MR * (pawns ? 2.0 : 1.75), 48).rotateX(-Math.PI / 2);
  const glowGeo = new THREE.CircleGeometry(MR * (pawns ? 1.9 : 1.65), 48).rotateX(-Math.PI / 2);
  const canM = new THREE.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0.95, depthWrite: false });
  const toM = new THREE.MeshBasicMaterial({ color: '#5fe1ff', transparent: true, opacity: 1, depthWrite: false });
  const toGlowM = new THREE.MeshBasicMaterial({ color: '#5fe1ff', transparent: true, opacity: 0.35, depthWrite: false });
  const marbles = new Map(), rings = new THREE.Group(), balls = new THREE.Group(); root.add(rings, balls);
  const tw = tweens(), REST = pawns ? H : H + MR * 0.55;
  function paint(d) {
    const seen = new Set();
    for (const m of d.marbles || []) {
      seen.add(m.sel);
      let o = marbles.get(m.sel);
      const to = at(m.x, m.y, REST + (m.picked ? 0.012 : 0));
      if (!o) { o = new THREE.Mesh(ballGeo, matFor(m.color)); o.castShadow = true; o.position.copy(to); balls.add(o); marbles.set(m.sel, o); }
      else if (o.position.distanceTo(to) > 1e-5) tw.add(o, to, { dur: o.position.distanceTo(to) > 0.03 ? 0.5 : 0.18, hop: o.position.distanceTo(to) > 0.03 ? 0.02 : 0 });
      o.userData.sel = m.can ? m.sel : null;
    }
    for (const [k, o] of marbles) if (!seen.has(k)) { balls.remove(o); marbles.delete(k); }
    for (const r of [...rings.children]) rings.remove(r);
    for (const m of d.marbles || []) if (m.can && !m.picked) { const r = new THREE.Mesh(ringGeo, canM); r.position.copy(at(m.x, m.y, H + 0.0006)); rings.add(r); }
    for (const t of d.targets || []) {
      const r = new THREE.Mesh(ringGeo, toM); r.position.copy(at(t.x, t.y, H + 0.0008)); r.userData.sel = t.sel; rings.add(r);
      const f = new THREE.Mesh(glowGeo, toGlowM); f.position.copy(at(t.x, t.y, H + 0.0007)); f.userData.sel = t.sel; rings.add(f);
    }
  }
  paint(data);
  ctx.onTap((hits) => {
    const d = ctx.handle.data;
    for (const h of hits) if (h.object.userData.sel) { d.onTap && d.onTap(h.object.userData.sel); return; }
    const b = hits.find((h) => h.object.userData.isBoard);
    if (!b) return;
    const sx = -b.point.x / U, sy = -b.point.z / U;
    const near = (list) => { let best = null, bd = 13; for (const t of list) { const dd = Math.hypot(t.x - sx, t.y - sy); if (dd < bd) { bd = dd; best = t; } } return best; };
    const t = near(d.targets || []) || near((d.marbles || []).filter((m) => m.can));
    if (t && d.onTap) d.onTap(t.sel);
  });
  // the soft shadow is the board's alone: the pieces cast their own through the key light, so a piece sliding redraws only
  // the view, never the blurred shadow pass (that pass on every frame of every bot move was the heaviest thing on a phone)
  ctx.addContactShadow({ y: 0.0005, size: HALF * 3.2, opacity: 0.7, blur: 3.2, darkness: 0.9, exclude: [balls, rings] });
  ctx.frame(board, { view: [0, 1.4, -1], pad: 0.76, ground: 'none', minZoom: 0.5, maxZoom: 2, light: [-0.55, 1.4, -0.4] });
  return {
    update(d) { paint(d); ctx.requestRender(); },
    tick(dt) { return tw.tick(dt) ? 'view' : false; },
    state() { return { marbles: marbles.size, rings: rings.children.length }; },
    dispose() { for (const x of [ballGeo, ringGeo, glowGeo, board.geometry]) x.dispose(); for (const m of [topM, sideM, canM, toM, toGlowM, ...Object.values(glass)]) m.dispose(); topMap.dispose(); },
  };
}
