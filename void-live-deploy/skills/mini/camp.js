/**
 * The camp of the RTS world (skills/rts.js, lib/rts.js): the drop-off, as Age of Empires' town centre is. A ring of stones round a fire
 * whose flames flicker, a log pile that grows with the wood the villagers bring, a cairn that grows with the stone, a basket with the
 * food. data: { stock: { wood, stone, food }, built: [keys] }. Nothing is tapped; the camp is read.
 */
export default async function build(ctx, data) {
  const { THREE, root, still } = ctx;
  const stone = new THREE.MeshStandardMaterial({ color: '#7d7f84', roughness: 0.95 }), ember = new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: 1 });
  const flameMat = new THREE.MeshStandardMaterial({ color: '#ff8a2a', emissive: '#ff5a10', emissiveIntensity: 1.4, roughness: 0.6, transparent: true, opacity: 0.92 });
  const log = new THREE.MeshStandardMaterial({ color: '#7a5230', roughness: 0.9 }), basketMat = new THREE.MeshStandardMaterial({ color: '#b8905a', roughness: 0.95 }), food = new THREE.MeshStandardMaterial({ color: '#d9532e', roughness: 0.7 });
  const geos = [];
  const G = (g) => { geos.push(g); return g; };
  const mesh = (g, m) => { const x = new THREE.Mesh(g, m); x.castShadow = x.receiveShadow = true; return x; };
  // the fire: a ring of eight stones, embers, three flames
  const fire = new THREE.Group(); root.add(fire);
  for (let i = 0; i < 8; i++) { const s = mesh(G(new THREE.DodecahedronGeometry(0.018, 0)), stone); const a = i / 8 * Math.PI * 2; s.position.set(Math.cos(a) * 0.075, 0.012, Math.sin(a) * 0.075); s.rotation.set(i, i * 0.7, 0); fire.add(s); }
  const bed = mesh(G(new THREE.CylinderGeometry(0.055, 0.06, 0.012, 16)), ember); bed.position.y = 0.006; fire.add(bed);
  const flames = [0, 1, 2].map((i) => { const f = mesh(G(new THREE.ConeGeometry(0.02 - i * 0.004, 0.07 - i * 0.012, 7)), flameMat); f.position.set((i - 1) * 0.014, 0.045 - i * 0.004, (i % 2 ? 1 : -1) * 0.01); f.castShadow = false; fire.add(f); return f; });
  // the piles, rebuilt from the stock
  const piles = new THREE.Group(); root.add(piles);
  let shown = null;
  function lay(stock) {
    while (piles.children.length) { const c = piles.children.pop(); c.geometry && c.geometry.dispose && !geos.includes(c.geometry) && c.geometry.dispose(); }
    const s = stock || {};
    const logs = Math.min(14, Math.max(0, Math.floor(+s.wood || 0)));
    const lg = G(new THREE.CylinderGeometry(0.009, 0.009, 0.09, 8));
    for (let i = 0; i < logs; i++) { const row = Math.floor(i / 4), col = i % 4; const m = mesh(lg, log); m.rotation.z = Math.PI / 2; m.position.set(-0.17 + (row % 2) * 0.01, 0.009 + row * 0.017, -0.04 + col * 0.022); piles.add(m); }
    const stones = Math.min(10, Math.max(0, Math.floor(+s.stone || 0)));
    const sg = G(new THREE.DodecahedronGeometry(0.014, 0));
    for (let i = 0; i < stones; i++) { const m = mesh(sg, stone); const layer = i < 6 ? 0 : i < 9 ? 1 : 2, k = layer ? i - (layer === 1 ? 6 : 9) : i; const a = k / (layer ? (layer === 1 ? 3 : 1) : 6) * Math.PI * 2; m.position.set(0.17 + Math.cos(a) * (0.03 - layer * 0.012), 0.012 + layer * 0.022, 0.03 + Math.sin(a) * (0.03 - layer * 0.012)); m.rotation.set(i, i, 0); piles.add(m); }
    const foods = Math.min(8, Math.max(0, Math.floor(+s.food || 0)));
    if (foods) {
      const b = mesh(G(new THREE.CylinderGeometry(0.03, 0.022, 0.03, 12, 1, true)), basketMat); b.material.side = THREE.DoubleSide; b.position.set(0.14, 0.015, -0.1); piles.add(b);
      const fg = G(new THREE.SphereGeometry(0.009, 8, 6));
      for (let i = 0; i < foods; i++) { const m = mesh(fg, food); const a = i / Math.max(1, foods) * Math.PI * 2; m.position.set(0.14 + Math.cos(a) * 0.014, 0.03 + (i % 2) * 0.008, -0.1 + Math.sin(a) * 0.014); piles.add(m); }
    }
    shown = { wood: logs, stone: stones, food: foods };
    ctx.requestRender();
  }
  lay(data.stock);
  const ground = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.002, 0.3), new THREE.MeshStandardMaterial({ color: '#4a4032', roughness: 1 })); ground.position.y = -0.001; ground.receiveShadow = true; root.add(ground);
  ctx.frame(root, { view: [0.5, 0.7, 1], pad: 0.78, light: [0.4, 1.2, 0.6], minZoom: 0.6, maxZoom: 1.6 });
  let t = 0;
  return {
    state() { return { shown, flames: flames.length }; },
    update(d) { if (d && d.stock) lay(d.stock); },
    tick(dt) {
      if (still) return false;
      t += dt;
      flames.forEach((f, i) => { const k = 1 + Math.sin(t * (7 + i * 2.3) + i) * 0.12; f.scale.set(k, 1 + Math.sin(t * (9 + i) + i * 2) * 0.18, k); f.rotation.y = t * (0.8 + i * 0.3); });
      flameMat.emissiveIntensity = 1.2 + Math.sin(t * 11) * 0.25;
      return 'view';
    },
    dispose() { for (const g of geos) g.dispose(); ground.geometry.dispose(); ground.material.dispose(); [stone, ember, flameMat, log, basketMat, food].forEach((m) => m.dispose()); },
  };
}
