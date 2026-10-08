/**
 * fireworks miniature — the co-op table standing in the void: Void's five cards stand facing you across the table (you can
 * read them, Void can't), your five stand facing Void (you see their backs, with what hints have told you chalked on),
 * the five firework rows lie in the middle, and the hint tokens (blue) and mistakes (red) sit at the side.
 * Built from code; the card keeps the rules (skills/fireworks-rules.js). A tap selects the card, as on the card.
 * data: { theirs: [{ c, r, known }], own: [{ known }], rows: [n x5], hints, mistakes, sel }
 */
const CW = 0.05, CH = 0.072, CT = 0.001;
const HEX = ['#e2453c', '#efc23a', '#3fae5a', '#3d7fe0', '#eceae4'];
export default async function build(ctx, data) {
  const { THREE, root } = ctx;
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.012, 0.34), new THREE.MeshPhysicalMaterial({ color: '#2a2f3a', roughness: 0.8, clearcoat: 0.2 }));
  top.position.y = 0.006; top.receiveShadow = true; root.add(top);
  const Y = 0.012;
  const tex = new Map();
  const face = (key, draw) => { if (tex.has(key)) return tex.get(key); const c = document.createElement('canvas'); c.width = 200; c.height = 288; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; tex.set(key, t); return t; };
  const front = (cc, r) => face('f' + cc + r, (g) => { g.fillStyle = '#fbfaf5'; g.fillRect(0, 0, 200, 288); g.fillStyle = HEX[cc]; g.fillRect(12, 12, 176, 264);
    g.fillStyle = cc === 4 ? '#222' : '#fff'; g.font = 'bold 150px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(r + 1), 100, 150);
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 4; for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; g.beginPath(); g.moveTo(100 + Math.cos(a) * 20, 52 + Math.sin(a) * 20); g.lineTo(100 + Math.cos(a) * 34, 52 + Math.sin(a) * 34); g.stroke(); } });
  const back = (known) => face('b' + known.c + '_' + known.r, (g) => { g.fillStyle = '#1b2233'; g.fillRect(0, 0, 200, 288); g.strokeStyle = '#3c4a6b'; g.lineWidth = 8; g.strokeRect(10, 10, 180, 268);
    g.fillStyle = known.c != null ? HEX[known.c] : 'rgba(255,255,255,.25)'; g.font = 'bold 120px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(known.r != null ? String(known.r + 1) : '?', 100, 150); });
  const geo = new THREE.BoxGeometry(CW, CH, CT), flatGeo = new THREE.BoxGeometry(CW, CT, CH), edge = new THREE.MeshStandardMaterial({ color: '#e9e6dc' });
  // a standing card: +z face toward Void's side, -z face toward you
  const stand = (towardYou, behind) => new THREE.Mesh(geo, [edge, edge, edge, edge, new THREE.MeshStandardMaterial({ map: behind }), new THREE.MeshStandardMaterial({ map: towardYou })]);
  const layer = new THREE.Group(); root.add(layer);
  const tokGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.004, 24), blue = new THREE.MeshStandardMaterial({ color: '#3d7fe0', roughness: 0.4 }), red = new THREE.MeshStandardMaterial({ color: '#e2453c', roughness: 0.4 }), dim = new THREE.MeshStandardMaterial({ color: '#3a3f4a', roughness: 0.8 });
  const ringGeo = new THREE.RingGeometry(CW * 0.62, CW * 0.72, 32).rotateX(-Math.PI / 2), ringM = new THREE.MeshBasicMaterial({ color: '#ffd76a' });
  function paint(d) {
    for (const o of [...layer.children]) { layer.remove(o); if (Array.isArray(o.material)) for (const m of o.material) if (m !== edge) m.dispose(); }
    const blank = back({ c: null, r: null });
    (d.theirs || []).forEach((c, k) => { const m = stand(front(c.c, c.r), blank); m.position.set((2 - k) * (CW + 0.008), Y + CH / 2, 0.11); m.rotation.x = 0.18; m.userData.sel = 'v' + k; m.castShadow = true; layer.add(m); });
    (d.own || []).forEach((c, k) => { const m = stand(back(c.known), blank); m.position.set((2 - k) * (CW + 0.008), Y + CH / 2, -0.11); m.rotation.x = -0.18; m.userData.sel = 'y' + k; m.castShadow = true; layer.add(m); });
    (d.rows || []).forEach((n, c) => { for (let r = 0; r < n; r++) { const m = new THREE.Mesh(flatGeo, [edge, edge, new THREE.MeshStandardMaterial({ map: front(c, r) }), edge, edge, edge]); m.rotation.y = Math.PI; m.position.set((2 - c) * (CW + 0.01), Y + CT / 2 + r * CT * 1.5, 0.0 + r * 0.004); layer.add(m); } });
    for (let k = 0; k < 8; k++) { const t = new THREE.Mesh(tokGeo, k < d.hints ? blue : dim); t.position.set(0.2 - (k % 2) * 0.018, Y + 0.002, 0.06 - Math.floor(k / 2) * 0.018); layer.add(t); }
    for (let k = 0; k < 3; k++) { const t = new THREE.Mesh(tokGeo, k < d.mistakes ? red : dim); t.position.set(-0.2, Y + 0.002, 0.04 - k * 0.02); layer.add(t); }
    if (d.sel) { const r = new THREE.Mesh(ringGeo, ringM); r.position.set((2 - d.sel.k) * (CW + 0.008), Y + 0.0006, d.sel.side === 'you' ? -0.11 : 0.11); layer.add(r); }
  }
  paint(data);
  ctx.onTap((hits) => { const h = hits.find((x) => x.object.userData.sel); if (h && ctx.handle.data.onTap) ctx.handle.data.onTap('button[data-i="' + h.object.userData.sel + '"]'); });
  ctx.addContactShadow({ y: 0.0005, size: 0.7, opacity: 0.7, blur: 3.2, darkness: 0.9, exclude: [] });
  ctx.frame(top, { view: [0, 1.1, -1], pad: 0.86, ground: 'none', minZoom: 0.5, maxZoom: 2.4, light: [-0.4, 1.4, -0.6] });
  return {
    update(d) { paint(d); ctx.requestRender(); },
    state() { return { cards: layer.children.filter((o) => o.userData.sel).length }; },
    dispose() { top.geometry.dispose(); top.material.dispose(); for (const x of [geo, flatGeo, tokGeo, ringGeo]) x.dispose(); for (const m of [edge, blue, red, dim, ringM]) m.dispose(); for (const t of tex.values()) t.dispose(); },
  };
}
