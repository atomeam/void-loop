/**
 * poker miniature — a felt card table standing in the void: your two cards face up in front of you, Void's two face down
 * across the table (they turn over only at a showdown, because they are only in `data` then), the board in the middle,
 * and the stacks and the pot as clay chips. Built from code; the card keeps the rules (skills/poker-rules.js).
 * data: { mine: [c, c], theirs: [c, c] | null, board: [c...], pot, stacks: { you, void }, hand }
 */
import { tweens } from './tabletop.js';

const CW = 0.063, CH = 0.088, CT = 0.0008; // a poker card, 63 x 88 mm
const RANKS = '23456789TJQKA', SUITS = '♠♥♦♣';
export default async function build(ctx, data) {
  const { THREE, root } = ctx;
  const felt = new THREE.MeshStandardMaterial({ color: '#1f6e45', roughness: 0.95 });
  const rail = new THREE.MeshPhysicalMaterial({ color: '#4a2e1a', roughness: 0.4, clearcoat: 0.6 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 96).scale(1, 1, 0.62), felt);
  top.position.y = 0.01; top.receiveShadow = true; root.add(top);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.018, 20, 120).rotateX(Math.PI / 2).scale(1, 1, 0.62), rail);
  ring.position.y = 0.022; ring.castShadow = true; root.add(ring);
  const Y = 0.0205;
  const faces = new Map();
  const faceTex = (c) => {
    if (faces.has(c)) return faces.get(c);
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 358; const g = cv.getContext('2d');
    g.fillStyle = '#fbfaf5'; g.fillRect(0, 0, 256, 358);
    if (c == null) { g.fillStyle = '#5b4ed6'; g.fillRect(14, 14, 228, 330); g.strokeStyle = '#a99cff'; g.lineWidth = 6; for (let k = -360; k < 360; k += 22) { g.beginPath(); g.moveTo(14 + k, 14); g.lineTo(14 + k + 330, 344); g.stroke(); } }
    else {
      const red = ((c / 13) | 0) === 1 || ((c / 13) | 0) === 2; g.fillStyle = red ? '#c0262b' : '#15161a';
      g.font = 'bold 64px Georgia, serif'; g.textAlign = 'left'; g.fillText(RANKS[c % 13].replace('T', '10'), 18, 70);
      g.font = '58px serif'; g.fillText(SUITS[(c / 13) | 0], 20, 130); g.font = '150px serif'; g.textAlign = 'center'; g.fillText(SUITS[(c / 13) | 0], 128, 250);
    }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; faces.set(c, t); return t;
  };
  const cardGeo = new THREE.BoxGeometry(CW, CT, CH);
  const edge = new THREE.MeshStandardMaterial({ color: '#f1efe6' });
  const card = (c) => { const m = new THREE.Mesh(cardGeo, [edge, edge, new THREE.MeshStandardMaterial({ map: faceTex(c), roughness: 0.5 }), edge, edge, edge]); m.castShadow = true; return m; };
  // chips: stacks of clay discs in four colours by value
  const chipGeo = new THREE.CylinderGeometry(0.0115, 0.0115, 0.0033, 40); // 23 mm clay chips, sized to the cards
  const chipM = [['#f4f1ea', 1], ['#c0262b', 5], ['#1f5fbf', 25], ['#15161a', 100]].map(([col, v]) => ({ m: new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 }), v }));
  const chips = (n, x, z) => { const g = new THREE.Group(); let left = Math.round(n), k = 0;
    for (const { m, v } of [...chipM].reverse()) { let cnt = Math.min(12, Math.floor(left / v)); left -= cnt * v; const off = (k++ - 1.5) * 0.026;
      for (let i = 0; i < cnt; i++) { const c = new THREE.Mesh(chipGeo, m); c.position.set(x + off, Y + 0.0017 + i * 0.0034, z); c.castShadow = true; g.add(c); } }
    return g; };
  const layer = new THREE.Group(); root.add(layer);
  const tw = tweens();
  let lastHand = null, lastBoard = 0;
  function paint(d) {
    for (const o of [...layer.children]) { layer.remove(o); if (Array.isArray(o.material)) o.material[2].dispose(); } // card faces are made per paint; the textures stay cached
    const fresh = d.hand !== lastHand; lastHand = d.hand;
    // you sit at -z: your cards near you, Void's across the table, the board in a row in the middle
    (d.mine || []).forEach((c, k) => { const m = card(c); m.position.set((0.5 - k) * (CW + 0.008), Y + CT / 2, -0.11); m.rotation.y = Math.PI + (k ? 0.06 : -0.06); layer.add(m); // turned to read the right way up from your seat
      if (fresh) { const to = m.position.clone(); m.position.set(0, Y + 0.05, 0.16); tw.add(m, to, { dur: 0.4, hop: 0.03, delay: k * 0.15 }); } });
    const theirs = d.theirs || [null, null];
    theirs.forEach((c, k) => { const m = card(c); m.position.set((k - 0.5) * (CW + 0.008), Y + CT / 2, 0.12); m.rotation.y = Math.PI + (k ? 0.06 : -0.06); layer.add(m); });
    (d.board || []).forEach((c, k) => { const m = card(c); m.position.set((2 - k) * (CW + 0.01), Y + CT / 2, 0.005); m.rotation.y = Math.PI; layer.add(m);
      if (k >= lastBoard && !fresh) { const to = m.position.clone(); m.position.set(0.25, Y + 0.04, 0.12); tw.add(m, to, { dur: 0.35, hop: 0.02, delay: (k - lastBoard) * 0.12 }); } });
    lastBoard = (d.board || []).length;
    if (d.stacks) { layer.add(chips(d.stacks.you, -0.17, -0.07)); layer.add(chips(d.stacks.void, -0.17, 0.07)); } // stacks on your right
    if (d.pot) layer.add(chips(d.pot, 0.2, 0.0));
  }
  paint(data);
  ctx.addContactShadow({ y: 0.0005, size: 0.8, opacity: 0.7, blur: 3.2, darkness: 0.9, exclude: [] });
  ctx.frame(top, { view: [0, 1.25, -1], pad: 0.62, ground: 'none', minZoom: 0.5, maxZoom: 2.4, light: [-0.4, 1.4, -0.5] });
  return {
    update(d) { paint(d); ctx.requestRender(); },
    tick(dt) { return tw.tick(dt); },
    state() { return { cards: layer.children.filter((o) => o.geometry === cardGeo).length }; },
    dispose() { for (const x of [top.geometry, ring.geometry, cardGeo, chipGeo]) x.dispose(); for (const m of [felt, rail, edge, ...chipM.map((c) => c.m)]) m.dispose(); for (const t of faces.values()) t.dispose(); },
  };
}
