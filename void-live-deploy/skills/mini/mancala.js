/**
 * mancala miniature — a long walnut Kalah board with twelve round pits and two stores, filled with glass beads. Built from
 * code. The card keeps the rules and Void's replies (skills/mancala.js); this shows `data` and presses the card's pits.
 * data: { pits: Array(12), store: [you, Void], playable: [i], onTap(selector) }
 * Layout as on the card: your pits 0-5 along the near row, left to right; Void's 11-6 along the far row, left to right;
 * Void's store on your left, yours on your right.
 */
const PW = 0.056, PR = 0.021, DEPTH = 0.012, H = 0.03, BEAD = 0.0062, SHOW = 18;
const COLORS = ['#4fb3d9', '#e35d6a', '#f2c14e', '#7bd389', '#b58df0', '#f39a4b'];
export default async function build(ctx, data) {
  const { THREE, root } = ctx;
  const L = PW * 6 + 0.17, D = 0.15;
  const walnut = new THREE.MeshPhysicalMaterial({ color: '#6a4122', roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  const hollow = new THREE.MeshStandardMaterial({ color: '#2e1a0c', roughness: 0.85 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(L, H, D), walnut);
  body.position.y = H / 2; body.castShadow = body.receiveShadow = true; body.userData.isBoard = true; root.add(body);
  // pits: a dark bowl sunk into the top with a turned rim
  const bowl = new THREE.SphereGeometry(PR, 48, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1, DEPTH / PR, 1);
  const rimGeo = new THREE.TorusGeometry(PR, 0.0016, 10, 48).rotateX(Math.PI / 2);
  const storeBowl = new THREE.SphereGeometry(1, 48, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const pitAt = (i) => { // world x, z of pit i
    if (i <= 5) return [(2.5 - i) * PW, -0.035];
    return [(2.5 - (11 - i)) * PW, 0.035];
  };
  const storeAt = (s) => [s === 1 ? L / 2 - 0.045 : -L / 2 + 0.045, 0]; // Void's store on your left (+x)
  const targets = [];
  for (let i = 0; i < 12; i++) {
    const [x, z] = pitAt(i);
    const b = new THREE.Mesh(bowl, hollow); b.position.set(x, H + 0.0002, z); b.userData.pit = i; root.add(b); targets.push(b);
    const r = new THREE.Mesh(rimGeo, walnut); r.position.set(x, H, z); root.add(r);
  }
  for (const s of [0, 1]) {
    const [x, z] = storeAt(s);
    const b = new THREE.Mesh(storeBowl, hollow); b.scale.set(0.03, DEPTH * 1.3, 0.058); b.position.set(x, H + 0.0002, z); root.add(b);
    const rim = new THREE.Mesh(rimGeo, walnut); rim.scale.set(0.03 / PR, 1, 0.058 / PR); rim.position.set(x, H, z); root.add(rim);
  }
  const beadGeo = new THREE.SphereGeometry(BEAD, 20, 14);
  const beadMats = COLORS.map((c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.12, transmission: 0.35, thickness: 0.006, clearcoat: 1 }));
  const glowGeo = new THREE.RingGeometry(PR * 1.08, PR * 1.25, 48).rotateX(-Math.PI / 2);
  const glowM = new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0.55 });
  const beads = new THREE.Group(), glows = new THREE.Group(); root.add(beads, glows);
  // a deterministic scatter, so a pit's beads don't jump around every time anything repaints
  const rand = (seed) => { let s = seed * 9301 + 49297; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
  function fill(n, x, z, rx, rz, seed, cap) {
    const r = rand(seed + 1);
    for (let k = 0; k < Math.min(n, cap); k++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.72, layer = Math.floor(k / 7);
      const m = new THREE.Mesh(beadGeo, beadMats[(seed + k) % beadMats.length]);
      m.position.set(x + Math.cos(a) * rx * d, H - DEPTH * 0.55 + BEAD + layer * BEAD * 1.3, z + Math.sin(a) * rz * d);
      m.castShadow = true; beads.add(m);
    }
  }
  let last = '';
  function paint(d) {
    const key = JSON.stringify([d.pits, d.store, d.playable]);
    if (key === last) return; last = key;
    for (const b of [...beads.children]) beads.remove(b);
    for (const g of [...glows.children]) glows.remove(g);
    (d.pits || []).forEach((n, i) => { const [x, z] = pitAt(i); fill(n, x, z, PR * 0.85, PR * 0.85, i * 31 + n, SHOW); });
    (d.store || []).forEach((n, s) => { const [x, z] = storeAt(s); fill(n, x, z, 0.024, 0.05, 500 + s * 77 + n, 40); });
    for (const i of d.playable || []) { const [x, z] = pitAt(i); const g = new THREE.Mesh(glowGeo, glowM); g.position.set(x, H + 0.0006, z); glows.add(g); }
  }
  paint(data);
  ctx.onTap((hits) => {
    let best = -1, bd = Infinity;
    for (const h of hits) {
      if (h.object.userData.pit !== undefined) { best = h.object.userData.pit; break; }
      if (h.object.parent === beads || h.object.userData.isBoard) {
        for (let i = 0; i < 12; i++) { const [x, z] = pitAt(i); const dd = Math.hypot(h.point.x - x, h.point.z - z); if (dd < bd) { bd = dd; best = i; } }
        if (bd > PR * 1.4) best = -1;
        break;
      }
    }
    if (best >= 0 && ctx.handle.data.onTap) ctx.handle.data.onTap('button[data-i="' + best + '"]');
  });
  ctx.addContactShadow({ y: 0.0005, size: L * 1.5, opacity: 0.7, blur: 3.2, darkness: 0.9, exclude: [] });
  ctx.frame(body, { view: [0, 1.5, -1], pad: 0.62, ground: 'none', minZoom: 0.5, maxZoom: 1.7, light: [-0.55, 1.4, -0.4] });
  return {
    update(d) { paint(d); ctx.requestRender(); },
    state() { return { beads: beads.children.length, glows: glows.children.length }; },
    dispose() { for (const x of [bowl, rimGeo, storeBowl, beadGeo, glowGeo, body.geometry]) x.dispose(); for (const m of [walnut, hollow, glowM, ...beadMats]) m.dispose(); },
  };
}
