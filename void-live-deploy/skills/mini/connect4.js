/**
 * connect4 miniature — the upright blue frame standing in the void, discs dropping down the columns and settling in the
 * holes, the winning four ringed in light. Built from code; the card keeps the rules (skills/connect4-rules.js).
 * data: { board: Array(42) of 0|1|2, last, win: [cells] | null, onTap(selector) }
 */
import { tweens } from './tabletop.js';

const R = 6, C = 7, P = 0.034, DR = 0.0145, TH = 0.008; // hole pitch 34 mm, disc radius 14.5 mm
export default async function build(ctx, data) {
  const { THREE, root } = ctx;
  const W = C * P + 0.02, H = R * P + 0.02;
  // the frame face: blue plastic with seven by six holes cut through it (a canvas alpha map does the cutting)
  const cv = document.createElement('canvas'); cv.width = 700; cv.height = Math.round(700 * H / W);
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#000';
  const sx = cv.width / W;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { g.beginPath(); g.arc((0.01 + (c + 0.5) * P) * sx, (0.01 + (r + 0.5) * P) * sx, (DR + 0.0012) * sx, 0, Math.PI * 2); g.fill(); }
  const alpha = new THREE.CanvasTexture(cv);
  const blue = new THREE.MeshPhysicalMaterial({ color: '#1f4fbf', roughness: 0.3, clearcoat: 0.6, alphaMap: alpha, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
  const face = new THREE.PlaneGeometry(W, H);
  const front = new THREE.Mesh(face, blue), back = new THREE.Mesh(face, blue);
  const y0 = 0.03 + H / 2;
  front.position.set(0, y0, -TH / 2 - 0.001); back.position.set(0, y0, TH / 2 + 0.001); back.rotation.y = Math.PI;
  front.castShadow = back.castShadow = true; front.userData.frame = back.userData.frame = true; root.add(front, back);
  const side = new THREE.MeshPhysicalMaterial({ color: '#1a43a6', roughness: 0.35 });
  for (const x of [-W / 2, W / 2]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.006, H, TH + 0.004), side); s.position.set(x, y0, 0); root.add(s);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.09), side); foot.position.set(x, 0.015, 0); foot.castShadow = true; root.add(foot); }
  const at = (cell) => { const r = Math.floor(cell / C), c = cell % C; return new THREE.Vector3(W / 2 - 0.01 - (c + 0.5) * P, y0 + H / 2 - 0.01 - (r + 0.5) * P, 0); };
  const discGeo = new THREE.CylinderGeometry(DR, DR, TH * 0.8, 48).rotateX(Math.PI / 2);
  const red = new THREE.MeshPhysicalMaterial({ color: '#e0303e', roughness: 0.35, clearcoat: 0.5 }), yellow = new THREE.MeshPhysicalMaterial({ color: '#f2c230', roughness: 0.35, clearcoat: 0.5 });
  const glow = new THREE.MeshBasicMaterial({ color: '#ffffff' }), ringGeo = new THREE.RingGeometry(DR * 1.02, DR * 1.2, 40);
  const discs = new THREE.Group(), rings = new THREE.Group(); root.add(discs, rings);
  const tw = tweens();
  let shown = Array(R * C).fill(0), objs = Array(R * C).fill(null);
  function paint(d) {
    (d.board || []).forEach((v, i) => {
      if (v === shown[i]) return;
      if (objs[i]) { discs.remove(objs[i]); objs[i] = null; }
      if (v) { const m = new THREE.Mesh(discGeo, v === 1 ? red : yellow); m.castShadow = true; const to = at(i);
        if (i === d.last) { m.position.set(to.x, y0 + H / 2 + 0.03, 0); tw.add(m, to, { dur: 0.12 + 0.05 * Math.floor(i / C), hop: 0 }); } else m.position.copy(to);
        discs.add(m); objs[i] = m; }
      shown[i] = v;
    });
    for (const o of [...rings.children]) rings.remove(o);
    for (const i of d.win || []) for (const z of [-TH / 2 - 0.0015, TH / 2 + 0.0015]) { const r = new THREE.Mesh(ringGeo, glow); r.position.copy(at(i)); r.position.z = z; if (z > 0) r.rotation.y = Math.PI; rings.add(r); }
  }
  paint(data);
  ctx.onTap((hits) => {
    const h = hits.find((x) => x.object.userData.frame || x.object.parent === discs); if (!h) return;
    const c = Math.floor((W / 2 - 0.01 - h.point.x) / P);
    if (c >= 0 && c < C && ctx.handle.data.onTap) ctx.handle.data.onTap('button[data-i="' + c + '"]');
  });
  ctx.addContactShadow({ y: 0.0005, size: W * 2.2, opacity: 0.7, blur: 3.2, darkness: 0.9, exclude: [] });
  ctx.frame(front, { view: [0.15, 0.25, -1], pad: 0.84, ground: 'none', minZoom: 0.5, maxZoom: 2.2, light: [-0.5, 1.2, -0.9] });
  return {
    update(d) { paint(d); ctx.requestRender(); },
    tick(dt) { return tw.tick(dt); },
    state() { return { discs: discs.children.length, win: rings.children.length / 2 }; },
    dispose() { for (const x of [face, discGeo, ringGeo]) x.dispose(); for (const m of [blue, side, red, yellow, glow]) m.dispose(); alpha.dispose(); },
  };
}
