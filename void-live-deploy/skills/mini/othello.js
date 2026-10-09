/**
 * othello miniature — green baize in a walnut frame, two-sided discs (black over white) that flip over when they change
 * colour. Built from code. The card keeps the rules (skills/othello.js); this shows `data` and presses the card's squares.
 * data: { board: Array(64) of 0|1|2 (1 black, 2 white), legal: [i], onTap(selector) }
 * Square i = row * 8 + col; row 0 is the far side, col 0 is on your left.
 */
import { tweens } from './tabletop.js';

const S = 0.05, R = S * 0.42, T = 0.0034, FRAME = 0.026, H = 0.022;
export default async function build(ctx, data) {
  const { THREE, root, phone } = ctx;
  const half = S * 4, pos = (i, y) => new THREE.Vector3((3.5 - (i % 8)) * S, y, (3.5 - Math.floor(i / 8)) * S);
  // the baize: felt green with the grid pressed in
  const px = phone ? 512 : 1024, c = document.createElement('canvas'); c.width = c.height = px;
  const g = c.getContext('2d'), grad = g.createRadialGradient(px * 0.4, px * 0.35, 0, px / 2, px / 2, px * 0.75);
  grad.addColorStop(0, '#2f9a5c'); grad.addColorStop(0.6, '#1f7445'); grad.addColorStop(1, '#165a35');
  g.fillStyle = grad; g.fillRect(0, 0, px, px);
  for (let k = 0; k < 9000; k++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${0.03 + Math.random() * 0.04})`; g.fillRect(Math.random() * px, Math.random() * px, 1.5, 1.5); }
  g.strokeStyle = 'rgba(5,40,20,.85)'; g.lineWidth = px / 300;
  for (let k = 0; k <= 8; k++) { const p = (k / 8) * px; g.beginPath(); g.moveTo(p, 0); g.lineTo(p, px); g.moveTo(0, p); g.lineTo(px, p); g.stroke(); }
  for (const [a, b] of [[2, 2], [2, 6], [6, 2], [6, 6]]) { g.fillStyle = 'rgba(5,40,20,.9)'; g.beginPath(); g.arc((a / 8) * px, (b / 8) * px, px / 160, 0, Math.PI * 2); g.fill(); }
  const feltMap = new THREE.CanvasTexture(c); feltMap.colorSpace = THREE.SRGBColorSpace; feltMap.anisotropy = 8;
  const felt = new THREE.MeshStandardMaterial({ map: feltMap, roughness: 0.95 });
  const walnut = new THREE.MeshPhysicalMaterial({ color: '#5a3a22', roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(half * 2, H, half * 2), [walnut, walnut, felt, walnut, walnut, walnut]);
  top.position.y = H / 2; top.receiveShadow = true; top.userData.isBoard = true; root.add(top);
  const W2 = half + FRAME;
  for (const [w, d, x, z] of [[W2 * 2, FRAME, 0, half + FRAME / 2], [W2 * 2, FRAME, 0, -half - FRAME / 2], [FRAME, half * 2, half + FRAME / 2, 0], [FRAME, half * 2, -half - FRAME / 2, 0]]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, H + 0.006, d), walnut); f.position.set(x, (H + 0.006) / 2, z); f.castShadow = f.receiveShadow = true; root.add(f);
  }
  // a disc: black face up, white face down; flipping turns it over
  const face = new THREE.CylinderGeometry(R, R, T / 2, 64);
  const blackM = new THREE.MeshPhysicalMaterial({ color: '#16171b', roughness: 0.35, clearcoat: 0.6 });
  const whiteM = new THREE.MeshPhysicalMaterial({ color: '#f1eee6', roughness: 0.3, clearcoat: 0.6 });
  const hintGeo = new THREE.CircleGeometry(R * 0.28, 32).rotateX(-Math.PI / 2);
  const hintM = new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.3 });
  function disc() {
    const d = new THREE.Group(), b = new THREE.Mesh(face, blackM), w = new THREE.Mesh(face, whiteM);
    b.position.y = T / 4; w.position.y = -T / 4; b.castShadow = w.castShadow = true; d.add(b, w); return d;
  }
  const discs = new THREE.Group(), hints = new THREE.Group(); root.add(discs, hints);
  const tw = tweens(), flips = [];
  let objs = Array(64).fill(null), shown = Array(64).fill(0);
  function paint(d) {
    const b = d.board || [];
    for (let i = 0; i < 64; i++) {
      const v = b[i] || 0;
      if (v === shown[i]) continue;
      if (!v) { if (objs[i]) { discs.remove(objs[i]); objs[i] = null; } }
      else if (!objs[i]) {
        const o = disc(); o.userData.i = i; o.rotation.x = v === 2 ? Math.PI : 0;
        const to = pos(i, H + T / 2); o.position.copy(pos(i, H + 0.04)); tw.add(o, to, { dur: 0.24, hop: 0 });
        discs.add(o); objs[i] = o;
      } else flips.push({ o: objs[i], from: objs[i].rotation.x, to: v === 2 ? Math.PI : 0, t: 0, lift: objs[i].position.y });
      shown[i] = v;
    }
    for (const h of [...hints.children]) hints.remove(h);
    for (const i of d.legal || []) { const h = new THREE.Mesh(hintGeo, hintM); h.position.copy(pos(i, H + 0.0006)); h.userData.i = i; hints.add(h); }
  }
  paint(data);
  ctx.onTap((hits) => {
    let i = -1;
    for (const h of hits) {
      let o = h.object; while (o && o.userData.i === undefined && o.parent) o = o.parent;
      if (o && o.userData.i !== undefined) { i = o.userData.i; break; }
      if (h.object.userData.isBoard) { const l = top.worldToLocal(h.point.clone()); const col = Math.round(3.5 - l.x / S), row = Math.round(3.5 - l.z / S); if (col >= 0 && col < 8 && row >= 0 && row < 8) i = row * 8 + col; break; }
    }
    if (i >= 0 && ctx.handle.data.onTap) ctx.handle.data.onTap('button[data-i="' + i + '"]');
  });
  ctx.addContactShadow({ y: 0.0005, size: W2 * 3, opacity: 0.7, blur: 3.2, darkness: 0.9, exclude: [] });
  ctx.frame(top, { view: [0, 1.2, -1], pad: 0.8, ground: 'none', minZoom: 0.5, maxZoom: 1.6, light: [-0.55, 1.4, -0.4] });
  return {
    update(d) { paint(d); ctx.requestRender(); },
    tick(dt) {
      let moved = tw.tick(dt);
      for (let k = flips.length - 1; k >= 0; k--) {
        const f = flips[k]; f.t = Math.min(1, f.t + dt / 0.42); const e = f.t < 0.5 ? 2 * f.t * f.t : 1 - Math.pow(-2 * f.t + 2, 2) / 2;
        f.o.rotation.x = f.from + (f.to - f.from) * e; f.o.position.y = f.lift + Math.sin(Math.PI * f.t) * 0.02;
        if (f.t >= 1) { f.o.position.y = f.lift; flips.splice(k, 1); }
        moved = true;
      }
      return moved;
    },
    state() { return { discs: discs.children.length, hints: hints.children.length }; },
    dispose() { for (const x of [face, hintGeo, top.geometry]) x.dispose(); for (const m of [felt, walnut, blackM, whiteM, hintM]) m.dispose(); feltMap.dispose(); },
  };
}
