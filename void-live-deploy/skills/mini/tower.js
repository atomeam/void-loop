/**
 * tower miniature — Versus in 3D (owner, 2026-10-25: "so you see all the layers. some things are missing, like a 3d tower"): the ladder as a
 * tower of stacked floors rising from a dark base in deep space, one floor per site in Versus order (the first conquest at the bottom). A surpassed floor is lit
 * and solid, its site's name etched in gold on its face; the current floor is under construction, a glowing scaffold with its "n of m" progress
 * ring; the few floors ahead are faint dark outlines (the queue has no end, so only the next AHEAD_SHOWN are drawn); the top carries Verse's
 * mark, a glowing core with three thin tilted rings. It turns slowly on its own (still with reduced motion). Tapping a floor calls
 * data.onFloor(id), or opens the floor's own Verse page when there is no callback.
 * data: { floors: [{ id, site, state: 'beaten' | 'current' | 'ahead', n, m, page? }], onFloor?: (id) => void }
 * Pure: layout(floors) says what is drawn where (tools/tower-mini.test.mjs).
 */
export const GOLD = '#e6c35c', VIOLET = '#c9b6ff';
export const MAX_LABELS = 12; // surpassed floors that carry their name: the last twelve under the current one
export const AHEAD_SHOWN = 3; // floors drawn above the current one, as outlines
export const SIDE = 0.34, GAP = 0.004, FLOOR_H = 0.07, MIN_FLOOR_H = 0.012, TOWER_H = 1.0, BASE_H = 0.03, BASE_R = 0.26;
const esc = (s) => String(s == null ? '' : s).slice(0, 48);

/** where every drawn floor goes: height scaled so 20+ floors still fit, labels capped to the last MAX_LABELS surpassed plus the current one.
 *  { floorH, drawn: [{ id, site, state, n, m, page, i, y, labelled }], floors, labelled, current (index in tower order, -1 when none), cut, height } */
export function layout(floors = [], { maxLabels = MAX_LABELS, aheadShown = AHEAD_SHOWN } = {}) {
  const all = (Array.isArray(floors) ? floors : []).map((f, i) => ({ id: String((f && f.id) || i), site: esc(f && f.site), state: f && f.state === 'current' ? 'current' : f && f.state === 'ahead' ? 'ahead' : 'beaten', n: +((f && f.n) || 0), m: +((f && f.m) || 0), page: f && typeof f.page === 'string' ? f.page : '', i }));
  const current = all.findIndex((f) => f.state === 'current');
  const upTo = current >= 0 ? current : all.length - 1; // the last floor drawn solid or as scaffold
  const drawn = all.filter((f, i) => i <= upTo || (f.state === 'ahead' && i <= upTo + aheadShown));
  const beatenIdx = drawn.filter((f) => f.state === 'beaten').map((f) => f.i), named = new Set(beatenIdx.slice(-maxLabels));
  if (current >= 0) named.add(current);
  const count = drawn.length, floorH = Math.max(MIN_FLOOR_H, Math.min(FLOOR_H, count ? (TOWER_H - count * GAP) / count : FLOOR_H));
  drawn.forEach((f, k) => { f.y = BASE_H + k * (floorH + GAP) + floorH / 2; f.labelled = named.has(f.i); });
  return { floorH, drawn, floors: all.length, labelled: named.size, current, cut: beatenIdx.length - Math.min(beatenIdx.length, maxLabels), height: BASE_H + count * (floorH + GAP) };
}

function nameTexture(THREE, text, sub, colour) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const g = c.getContext('2d');
  g.clearRect(0, 0, 1024, 256); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = colour;
  const size = (px, s) => { g.font = '600 ' + px + 'px Georgia, "Times New Roman", serif'; while (px > 40 && g.measureText(s).width > 940) { px -= 6; g.font = '600 ' + px + 'px Georgia, "Times New Roman", serif'; } return px; };
  size(sub ? 124 : 176, text); g.shadowColor = colour; g.shadowBlur = 6; g.fillText(text, 512, sub ? 90 : 128);
  if (sub) { g.shadowBlur = 0; g.font = '600 92px Georgia, "Times New Roman", serif'; g.fillText(sub, 512, 196); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
export default function build(ctx, data) {
  const { THREE, root } = ctx;
  const geos = [], mats = [], G = (g) => (geos.push(g), g), M = (m) => (mats.push(m), m);
  const stone = M(new THREE.MeshStandardMaterial({ color: '#1b1726', roughness: 0.55, metalness: 0.25, emissive: '#2a1f4a', emissiveIntensity: 0.55 }));
  const baseM = M(new THREE.MeshStandardMaterial({ color: '#0c0b12', roughness: 0.8, metalness: 0.1 }));
  const goldLine = M(new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.85 }));
  const scaffold = M(new THREE.LineBasicMaterial({ color: VIOLET, transparent: true, opacity: 0.95 }));
  const ghost = M(new THREE.LineBasicMaterial({ color: '#4a4466', transparent: true, opacity: 0.35 }));
  const ringGold = M(new THREE.MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 1.2, roughness: 0.3, metalness: 0.8 }));
  const ringFaint = M(new THREE.MeshStandardMaterial({ color: '#3a3550', roughness: 0.6, transparent: true, opacity: 0.5 }));
  const core = M(new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffd36a', emissiveIntensity: 2.2, roughness: 0.2 }));
  const orbitM = M(new THREE.MeshStandardMaterial({ color: VIOLET, emissive: VIOLET, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.6 }));
  const boxG = G(new THREE.BoxGeometry(SIDE, 1, SIDE)), edgeG = G(new THREE.EdgesGeometry(boxG)); // scaled in y to the floor height
  const labelG = G(new THREE.PlaneGeometry(SIDE * 0.9, SIDE * 0.9 / 4));
  const base = new THREE.Mesh(G(new THREE.CylinderGeometry(BASE_R, BASE_R * 1.12, BASE_H, 64)), baseM); base.position.y = BASE_H / 2; base.castShadow = base.receiveShadow = true;
  const baseRim = new THREE.Mesh(G(new THREE.TorusGeometry(BASE_R, 0.003, 10, 96).rotateX(Math.PI / 2)), ringGold); baseRim.position.y = BASE_H;
  const tower = new THREE.Group(), mark = new THREE.Group();
  // Verse's mark: a glowing core with three thin tilted rings (lib/void-seal.js, the atom galaxy, kept simple)
  const sun = new THREE.Mesh(G(new THREE.SphereGeometry(0.028, 32, 24)), core); mark.add(sun);
  const ringG = G(new THREE.TorusGeometry(0.062, 0.0028, 8, 96)), rings = [];
  for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(ringG, i === 1 ? ringGold : orbitM); r.rotation.set(1.1 + i * 0.5, i * 2.1, i * 0.7); mark.add(r); rings.push(r); }
  root.add(base, baseRim, tower, mark);
  let d = data || {}, lay = layout([]), floorMeshes = [], perFloor = [], moreLabel = null;
  const clear = () => { for (const x of perFloor) { tower.remove(x.obj); for (const g of x.geos) g.dispose(); for (const t of x.texs) t.dispose(); for (const m of x.mats) m.dispose(); } perFloor = []; floorMeshes = []; if (moreLabel) { root.remove(moreLabel.obj); moreLabel.tex.dispose(); moreLabel.mat.dispose(); if (moreLabel.geo) moreLabel.geo.dispose(); moreLabel = null; } };
  const label = (text, sub, colour, w) => {
    const tex = nameTexture(THREE, text, sub, colour), mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    const g = w ? new THREE.PlaneGeometry(w, w / 4) : labelG, both = new THREE.Group();
    for (const side of [1, -1]) { const p = new THREE.Mesh(g, mat); p.position.z = side * (SIDE / 2 + 0.002); if (side < 0) p.rotation.y = Math.PI; p.raycast = () => {}; both.add(p); }
    return { obj: both, tex, mat, geo: w ? g : null };
  };
  function lay3d() {
    clear(); lay = layout(d.floors);
    const fit = Math.min(1, lay.floorH * 0.9 / (SIDE * 0.9 / 4)); // a name fills its floor's face, never taller than the floor
    for (const f of lay.drawn) {
      const x = { obj: new THREE.Group(), geos: [], texs: [], mats: [] }; x.obj.position.y = f.y; x.obj.userData.floorId = f.id;
      if (f.state === 'beaten') {
        const m = new THREE.Mesh(boxG, stone); m.scale.y = lay.floorH; m.castShadow = m.receiveShadow = true; m.userData.floorId = f.id; x.obj.add(m); floorMeshes.push(m);
        const e = new THREE.LineSegments(edgeG, goldLine); e.scale.y = lay.floorH; x.obj.add(e);
        if (f.labelled) { const L = label(f.site, '', GOLD); L.obj.scale.setScalar(fit); x.obj.add(L.obj); x.texs.push(L.tex); x.mats.push(L.mat); }
      } else if (f.state === 'current') {
        // under construction: a scaffold, a hit box nobody sees, the progress ring around it and "n of m"
        const e = new THREE.LineSegments(edgeG, scaffold); e.scale.y = lay.floorH; x.obj.add(e);
        const hit = new THREE.Mesh(boxG, new THREE.MeshBasicMaterial({ visible: false })); hit.scale.y = lay.floorH; hit.userData.floorId = f.id; x.mats.push(hit.material); x.obj.add(hit); floorMeshes.push(hit);
        const r = SIDE * 0.78, faint = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0035, 8, 96).rotateX(Math.PI / 2), ringFaint); x.geos.push(faint.geometry); x.obj.add(faint);
        const frac = f.m ? Math.max(0, Math.min(1, f.n / f.m)) : 0;
        if (frac > 0) { const arc = new THREE.Mesh(new THREE.TorusGeometry(r, 0.006, 10, Math.max(8, Math.round(96 * frac)), Math.PI * 2 * frac).rotateX(Math.PI / 2), ringGold); x.geos.push(arc.geometry); x.obj.add(arc); }
        const L = label(f.site, f.n + ' of ' + f.m, VIOLET); L.obj.scale.setScalar(Math.min(1.15, fit * 1.5)); x.obj.add(L.obj); x.texs.push(L.tex); x.mats.push(L.mat); // the scaffold is open: its sign stands a little taller than the floor
      } else {
        const e = new THREE.LineSegments(edgeG, ghost); e.scale.y = lay.floorH; x.obj.add(e);
        const hit = new THREE.Mesh(boxG, new THREE.MeshBasicMaterial({ visible: false })); hit.scale.y = lay.floorH; hit.userData.floorId = f.id; x.mats.push(hit.material); x.obj.add(hit); floorMeshes.push(hit);
      }
      tower.add(x.obj); perFloor.push(x);
    }
    if (lay.cut > 0) { moreLabel = label('+' + lay.cut + ' more below', '', GOLD, BASE_R * 1.6); moreLabel.obj.position.y = BASE_H / 2; moreLabel.obj.children.forEach((p) => { p.position.z = Math.sign(p.position.z) * (BASE_R * 1.06); }); moreLabel.obj.scale.setScalar(0.5); root.add(moreLabel.obj); }
    mark.position.y = lay.height + 0.09;
  }
  lay3d();
  ctx.frame(root, { view: [0.55, 0.35, 1], pad: 1.05, light: [0.6, 1.2, 0.8], minZoom: 0.5, maxZoom: 2.2, ground: 'none' });
  ctx.onTap((hits) => {
    const h = hits && hits.find((x) => x.object.userData.floorId !== undefined); if (!h) return;
    const id = h.object.userData.floorId, f = lay.drawn.find((x) => x.id === id);
    const cb = ctx.handle && ctx.handle.data && ctx.handle.data.onFloor; // the latest callback the card passed
    if (typeof cb === 'function') cb(id); else if (f && f.page && /^\/[^/]/.test(f.page)) window.open(f.page, '_blank', 'noopener');
  });
  const still = ctx.still;
  return {
    update(nd) { d = nd || {}; lay3d(); ctx.frame(root, { view: [0.55, 0.35, 1], pad: 1.05, light: [0.6, 1.2, 0.8], minZoom: 0.5, maxZoom: 2.2, ground: 'none' }); },
    state: () => ({ floors: lay.floors, drawn: lay.drawn.length, labelled: lay.labelled, current: lay.current, cut: lay.cut, floorH: lay.floorH, turning: !still }),
    tick(dt) {
      if (still) return false;
      root.rotation.y += dt * 0.22; for (let i = 0; i < rings.length; i++) rings[i].rotation.y += dt * (0.6 + i * 0.25);
      return 'view';
    },
    dispose() { clear(); for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); },
  };
}
